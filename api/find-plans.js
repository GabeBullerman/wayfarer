const { groqChat } = require('./_groq');
const { guard } = require('./_auth');

/**
 * Searches Tavily for live web results about activities/events in a destination.
 * Returns an array of { title, url, content } results.
 */
async function tavilySearch(query, apiKey, maxResults = 5) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.results ?? []).map(r => ({
    title:   r.title   ?? '',
    url:     r.url     ?? '',
    content: r.content ?? '',
  }));
}

// ── Date validation ─────────────────────────────────────────────────────────
// Guarantees Find Plans only returns suggestions that are actually available on
// the selected day: evergreen activities (no date) always pass; date-specific
// events pass only when the target date falls within their run dates. We check
// both the model's structured eventStart/eventEnd AND any date mentioned in the
// suggestion text, so a model lapse can't leak an off-date event through.

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8,
  oct: 9, nov: 10, dec: 11,
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)'; // (?!\d) so "August 1923" isn't read as day 19
const SEP = '\\s*(?:-|–|—|to|through|thru|until)\\s*';
const YEAR = '(?:,?\\s*(\\d{4}))?';

const key = (y, m, d) => Date.UTC(y, m, d);

/**
 * Extract concrete date ranges mentioned in `text`, restricted to the trip's
 * timeframe (target year, within ±1 month of the target month) so historical or
 * unrelated dates don't trigger false drops. Returns [{ startKey, endKey }].
 */
function extractRanges(text, ty, tmonth) {
  if (!text) return [];
  const ranges = [];
  let work = ` ${text} `;

  const inContext = (m, y) => y === ty && Math.abs(m - tmonth) <= 1;
  const consume = (re, handler) => {
    work = work.replace(new RegExp(re, 'gi'), (...args) => {
      handler(args);
      return ' '.repeat(args[0].length); // blank out so later patterns don't re-match
    });
  };

  // Cross-month range: "August 30 - September 2[, 2026]"
  consume(MONTH_RE + '\\s+' + DAY + SEP + MONTH_RE + '\\s+' + DAY + YEAR, (a) => {
    const [, m1, d1, m2, d2, yr] = a;
    const y = yr ? +yr : ty;
    const sM = MONTHS[m1.toLowerCase()], eM = MONTHS[m2.toLowerCase()];
    if (sM == null || eM == null) return;
    if (inContext(sM, y) || inContext(eM, y)) ranges.push({ startKey: key(y, sM, +d1), endKey: key(y, eM, +d2) });
  });

  // Same-month range: "August 8-15[, 2026]"
  consume(MONTH_RE + '\\s+' + DAY + SEP + DAY + YEAR, (a) => {
    const [, mo, d1, d2, yr] = a;
    const y = yr ? +yr : ty;
    const m = MONTHS[mo.toLowerCase()];
    if (m == null || !inContext(m, y)) return;
    ranges.push({ startKey: key(y, m, +d1), endKey: key(y, m, +d2) });
  });

  // Single date: "August 9[, 2026]"
  consume(MONTH_RE + '\\s+' + DAY + YEAR, (a) => {
    const [, mo, d, yr] = a;
    const y = yr ? +yr : ty;
    const m = MONTHS[mo.toLowerCase()];
    if (m == null || !inContext(m, y)) return;
    ranges.push({ startKey: key(y, m, +d), endKey: key(y, m, +d) });
  });

  return ranges;
}

/** ISO (YYYY-MM-DD) → day key, or null. */
function isoKey(s) {
  const m = typeof s === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? key(+m[1], +m[2] - 1, +m[3]) : null;
}

/** True if a suggestion is available on the target day. */
function isValidForDate(s, ty, tmonth, targetKey) {
  const ranges = [];

  // Structured constraint from the model.
  const sk = isoKey(s.eventStart);
  if (sk != null) ranges.push({ startKey: sk, endKey: isoKey(s.eventEnd) ?? sk });

  // Constraints parsed from the suggestion's own text.
  ranges.push(...extractRanges(`${s.title ?? ''} ${s.description ?? ''}`, ty, tmonth));

  if (ranges.length === 0) return true; // evergreen / no date constraint
  return ranges.some(r => targetKey >= r.startKey && targetKey <= r.endKey);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await guard(req, res);
  if (!user) return;

  const groqKey   = process.env.GROQ_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!groqKey)   return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  if (!tavilyKey) return res.status(500).json({ error: 'TAVILY_API_KEY not configured' });

  const { destination, date, dayNumber, totalDays } = req.body ?? {};
  if (!destination) return res.status(400).json({ error: 'Missing destination' });

  const dateObj   = date ? new Date(date) : new Date();
  const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fullDate  = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dayMonth  = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Target day, parsed from the ISO prefix to avoid timezone drift.
  const isoPrefix = (typeof date === 'string' ? date : dateObj.toISOString()).slice(0, 10);
  const [ty, tmRaw, td] = isoPrefix.split('-').map(Number);
  const tmonth = (tmRaw || 1) - 1;
  const targetKey = key(ty, tmonth, td);

  try {
    // Run live searches in parallel. Events are queried for the SPECIFIC date so
    // we surface things actually happening that day, not just somewhere in the month.
    const [activityResults, eventResults, restaurantResults] = await Promise.all([
      tavilySearch(`best things to do in ${destination} ${monthYear}`, tavilyKey),
      tavilySearch(`events happening in ${destination} on ${dayMonth}`, tavilyKey),
      tavilySearch(`best restaurants to eat in ${destination}`, tavilyKey, 3),
    ]);

    const formatResults = (results) =>
      results.map(r => `SOURCE: ${r.url}\n${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n');

    const searchContext = `
=== ACTIVITIES & SIGHTS ===
${formatResults(activityResults)}

=== EVENTS ===
${formatResults(eventResults)}

=== RESTAURANTS ===
${formatResults(restaurantResults)}
`.trim();

    const content = await groqChat(groqKey, [
        {
          role: 'system',
          content: `You extract travel activity suggestions from live web search results. Return ONLY a valid JSON array — no markdown, no explanation.

Each object must have:
- "title": name of the activity, place, or event
- "category": one of "activity" | "food" | "transport" | "other"
- "time": suggested start time like "09:00" or null
- "description": 1–2 sentences from the search results describing it. Be specific and factual. Do NOT state a calendar date that is different from the traveler's visit date.
- "location": specific address or area name (or null)
- "estimatedCost": e.g. "Free", "~€15", "$30–50" (or null)
- "sourceUrl": the URL this came from
- "eventStart": for a DATE-SPECIFIC event, the ISO date (YYYY-MM-DD) it starts. For anything available daily (sights, museums, restaurants, parks, regular tours), set null.
- "eventEnd": ISO date (YYYY-MM-DD) the event ends (same as eventStart for a one-day event), or null for evergreen items.

CRITICAL DATE RULE: The traveler is there on ONE specific day. ONLY include a date-specific event if that day falls within its eventStart..eventEnd range. NEVER suggest an event happening on a different date. When unsure of an event's exact dates, prefer evergreen activities/restaurants (eventStart/eventEnd null) instead.`,
        },
        {
          role: 'user',
          content: `Destination: ${destination}
Visit date: ${fullDate}  (ISO ${isoPrefix}) — Day ${dayNumber} of ${totalDays}

Live web search results about activities, events, and restaurants:

${searchContext}

Extract 9 varied, specific suggestions the traveler can actually do ON ${fullDate}. Favor evergreen sights, food, and local experiences (eventStart/eventEnd null). Only include a dated event if ${isoPrefix} is within its run dates. Return a JSON array.`,
        },
      ], { maxTokens: 1800 });

    let text = content.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let suggestions = [];
    try {
      suggestions = JSON.parse(text);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch (_) {
      suggestions = [];
    }

    // Hard guarantee: drop anything whose dates don't include the visit day,
    // then cap at 7. Strip the internal date fields from the response.
    const valid = suggestions
      .filter(s => s && isValidForDate(s, ty, tmonth, targetKey))
      .slice(0, 7)
      .map(({ eventStart, eventEnd, ...rest }) => rest);

    return res.status(200).json({ suggestions: valid });
  } catch (err) {
    console.error('[find-plans]', err?.message ?? err);
    return res.status(500).json({ error: `Failed to fetch live plans: ${err?.message ?? err}` });
  }
};

// Exposed for unit tests; does not affect the Vercel serverless handler export.
module.exports.isValidForDate = isValidForDate;
module.exports.extractRanges = extractRanges;
