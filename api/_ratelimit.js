// Best-effort in-memory fixed-window rate limiter.
//
// NOTE: serverless functions scale to many isolated instances, so this Map is
// per-instance — it caps abuse from a single warm instance but is NOT a global
// guarantee. For hard global limits add Upstash Redis / Vercel KV and swap the
// store here. Because the paid endpoints now also require auth, this limiter
// keys on the authenticated uid, which is enough to stop a single account from
// hammering the paid APIs.
const buckets = new Map();

/**
 * @param {string} key   identifier to limit on (e.g. uid)
 * @param {{limit?:number, windowMs?:number}} opts
 * @returns {{ok:boolean, retryAfter?:number}}
 */
function rateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || now > e.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true };
  }
  e.count++;
  if (e.count > limit) {
    return { ok: false, retryAfter: Math.ceil((e.reset - now) / 1000) };
  }
  return { ok: true };
}

/** Convenience: enforce a limit and send 429 if exceeded. Returns true if OK. */
function enforceRateLimit(res, key, opts) {
  // Opportunistic cleanup so the Map can't grow unbounded.
  if (buckets.size > 5000) {
    const now = Date.now();
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const r = rateLimit(key, opts);
  if (!r.ok) {
    res.setHeader('Retry-After', String(r.retryAfter));
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return false;
  }
  return true;
}

module.exports = { rateLimit, enforceRateLimit };
