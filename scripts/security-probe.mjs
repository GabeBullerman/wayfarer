#!/usr/bin/env node
// Black-box security probe for the SorTrek API surface.
//
// SAFE BY DESIGN: every check uses inputs that make endpoints return early
// (400/405) BEFORE they call any paid third party (Groq/Tavily/flight APIs),
// and request counts are tiny. This demonstrates gaps (missing auth, no rate
// limiting, error leakage, SSRF) WITHOUT actually attacking or running up bills.
//
// Usage:  node scripts/security-probe.mjs [baseUrl]
//         BASE defaults to the production deployment.

const BASE = process.argv[2] || 'https://sortrek.vercel.app';

let pass = 0, warn = 0, fail = 0;
const rows = [];
const rec = (level, name, detail) => {
  rows.push({ level, name, detail });
  if (level === 'PASS') pass++; else if (level === 'WARN') warn++; else fail++;
};

async function req(path, { method = 'POST', body, headers } = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    return { status: r.status, headers: r.headers, text, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, error: String(e), ms: Date.now() - t0 };
  }
}

// ── 1. Unauthenticated access to paid AI endpoints ──────────────────────────
// Missing required fields → 400 BEFORE any Groq/Tavily call. If we reach the
// app's own validation as an anonymous caller, there is no auth gate.
async function checkNoAuth() {
  const cases = [
    ['/api/ai-advisor', { /* no type/trip */ }],
    ['/api/find-plans', { /* no destination */ }],
    ['/api/transport', { action: '__none__' }],
  ];
  for (const [path, body] of cases) {
    const r = await req(path, { body });
    // 400/405 with the app's own error means it processed an anonymous request.
    if (r.status === 400 || r.status === 405) {
      rec('FAIL', `No auth gate: ${path}`,
        `anonymous POST reached app logic (HTTP ${r.status}). A scripted client can call this paid endpoint without logging in.`);
    } else if (r.status === 401 || r.status === 403) {
      rec('PASS', `Auth required: ${path}`, `HTTP ${r.status}`);
    } else {
      rec('WARN', `Unexpected: ${path}`, `HTTP ${r.status}: ${(r.text||'').slice(0,120)}`);
    }
  }
}

// ── 2. SSRF guard on place-photo ────────────────────────────────────────────
async function checkSSRF() {
  const targets = [
    'http://169.254.169.254/latest/meta-data/',     // cloud metadata
    'http://localhost:3001/api/ai-advisor',          // internal service
    'http://127.0.0.1:80/',
    'file:///etc/passwd',
    'https://evil.example.com/x.jpg',
  ];
  for (const url of targets) {
    const r = await req('/api/place-photo', { body: { url } });
    // 401 = auth gate rejects before the fetch even runs; 400 = host allowlist
    // rejects it. Either means the SSRF target is not reachable.
    if (r.status === 400 || r.status === 401) rec('PASS', `SSRF blocked: ${url.slice(0, 40)}`, `HTTP ${r.status}`);
    else rec('FAIL', `SSRF NOT blocked: ${url}`, `HTTP ${r.status}: ${(r.text||'').slice(0,120)}`);
  }
}

// ── 3. public-itinerary robustness (must 404, never 500) ────────────────────
async function checkPublicItinerary() {
  const tokens = [
    'nope', '../../etc/passwd', '"; DROP TABLE trips;--',
    '{"$ne":null}', '<script>alert(1)</script>', 'a'.repeat(5000),
  ];
  for (const tk of tokens) {
    const r = await req(`/api/public-itinerary?token=${encodeURIComponent(tk)}`, { method: 'GET' });
    if (r.status === 404 || r.status === 400) rec('PASS', `Bad token handled: ${tk.slice(0,24)}`, `HTTP ${r.status}`);
    else if (r.status >= 500) rec('FAIL', `Server error on token: ${tk.slice(0,24)}`, `HTTP ${r.status}`);
    else rec('WARN', `Token ${tk.slice(0,24)}`, `HTTP ${r.status}`);
  }
}

// ── 4. HTTP method enforcement ──────────────────────────────────────────────
async function checkMethods() {
  for (const path of ['/api/ai-advisor', '/api/place-photo', '/api/find-plans']) {
    const r = await req(path, { method: 'GET' });
    if (r.status === 405) rec('PASS', `Method enforced: ${path}`, 'GET → 405');
    else rec('WARN', `Method not enforced: ${path}`, `GET → ${r.status}`);
  }
}

// ── 5. Security headers ─────────────────────────────────────────────────────
async function checkHeaders() {
  const r = await req('/api/public-itinerary?token=nope', { method: 'GET' });
  const h = r.headers;
  const checks = [
    ['x-content-type-options', 'nosniff'],
    ['strict-transport-security', null],
  ];
  for (const [name, want] of checks) {
    const v = h?.get?.(name);
    if (v && (!want || v.toLowerCase().includes(want))) rec('PASS', `Header ${name}`, v);
    else rec('WARN', `Missing header: ${name}`, want ? `expected ~"${want}"` : 'recommended');
  }
}

// ── 6. Error-detail leakage ─────────────────────────────────────────────────
async function checkErrorLeak() {
  const r = await req('/api/ai-advisor', { body: { type: 'packing' /* no trip */ } });
  const leaks = /stack|at \w+ \(|node_modules|\/var\/task|TypeError|ReferenceError/i.test(r.text || '');
  if (leaks) rec('FAIL', 'Stack/path leak in error', (r.text||'').slice(0, 160));
  else rec('PASS', 'No stack/path leak', `HTTP ${r.status}`);
}

// ── 7. Anonymous flood is rejected before reaching paid services ────────────
// With the auth gate in place, 20 rapid anonymous requests should all be 401'd
// (rejected before any Groq/Tavily call). Per-uid rate limiting then applies
// only to authenticated callers, so it can't be exercised anonymously here.
async function checkRateLimit() {
  const N = 20;
  const rs = await Promise.all(
    Array.from({ length: N }, () => req('/api/ai-advisor', { body: {} }))
  );
  const blocked = rs.filter(r => r.status === 401 || r.status === 429).length;
  if (blocked === N) rec('PASS', 'Anonymous flood blocked', `${blocked}/${N} rejected (401/429) before any paid call`);
  else rec('FAIL', 'Anonymous requests reach paid logic', `only ${blocked}/${N} were rejected`);
}

const C = { PASS: '\x1b[32m', WARN: '\x1b[33m', FAIL: '\x1b[31m', off: '\x1b[0m' };

(async () => {
  console.log(`\nSorTrek security probe → ${BASE}\n${'='.repeat(60)}`);
  await checkNoAuth();
  await checkSSRF();
  await checkPublicItinerary();
  await checkMethods();
  await checkHeaders();
  await checkErrorLeak();
  await checkRateLimit();

  for (const { level, name, detail } of rows) {
    console.log(`${C[level]}${level.padEnd(4)}${C.off}  ${name}\n        ${detail}`);
  }
  console.log('='.repeat(60));
  console.log(`${C.PASS}${pass} pass${C.off}  ${C.WARN}${warn} warn${C.off}  ${C.FAIL}${fail} fail${C.off}\n`);
})();
