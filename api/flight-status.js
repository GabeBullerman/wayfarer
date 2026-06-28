// Live flight status lookup.
//
// Tracks a flight by its IATA flight number (e.g. "DL123") and, optionally, a
// date, returning real-time / estimated / actual departure & arrival times,
// status, gate, terminal and delay.
//
// Providers (first configured one wins):
//   1. AviationStack  — set AVIATIONSTACK_API_KEY  (free tier: http only)
//   2. AeroDataBox    — set AERODATABOX_RAPIDAPI_KEY (RapidAPI)
//
// If neither key is configured the endpoint responds 200 with
// { configured: false } so the UI can show a friendly "not set up" message
// instead of erroring.
const { guard } = require('./_auth');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Split "DL123" / "dl 123" into { carrier: "DL", number: "123" }. */
function parseFlightNumber(raw) {
  const cleaned = String(raw ?? '').toUpperCase().replace(/\s+/g, '');
  const m = cleaned.match(/^([A-Z0-9]{2,3}?)(\d{1,4})$/);
  if (!m) return { carrier: null, number: null, iata: cleaned || null };
  return { carrier: m[1], number: m[2], iata: `${m[1]}${m[2]}` };
}

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const diff = new Date(a).getTime() - new Date(b).getTime();
  if (Number.isNaN(diff)) return null;
  return Math.round(diff / 60000);
}

function sameDay(iso, dateStr) {
  if (!iso || !dateStr) return false;
  return String(iso).slice(0, 10) === String(dateStr).slice(0, 10);
}

// ── AviationStack ────────────────────────────────────────────────────────────

async function fetchAviationStack(key, iata, date) {
  const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${encodeURIComponent(iata)}&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AviationStack ${res.status}`);
  const body = await res.json();
  if (body?.error) throw new Error(body.error?.message ?? 'AviationStack error');

  const rows = Array.isArray(body?.data) ? body.data : [];
  if (rows.length === 0) return null;

  // Prefer the row matching the requested date; otherwise the first non-landed,
  // otherwise just the first result.
  let row =
    (date && rows.find(r => sameDay(r?.departure?.scheduled, date))) ||
    rows.find(r => r?.flight_status && r.flight_status !== 'landed') ||
    rows[0];

  const dep = row.departure ?? {};
  const arr = row.arrival ?? {};
  return {
    flightStatus: row.flight_status ?? 'unknown',
    airline: row.airline?.name ?? null,
    flightNumber: row.flight?.iata ?? iata,
    departureAirport: dep.iata ?? null,
    arrivalAirport: arr.iata ?? null,
    scheduledDeparture: dep.scheduled ?? null,
    estimatedDeparture: dep.estimated ?? null,
    actualDeparture: dep.actual ?? null,
    scheduledArrival: arr.scheduled ?? null,
    estimatedArrival: arr.estimated ?? null,
    actualArrival: arr.actual ?? null,
    departureTerminal: dep.terminal ?? null,
    departureGate: dep.gate ?? null,
    arrivalTerminal: arr.terminal ?? null,
    arrivalGate: arr.gate ?? null,
    departureDelayMinutes:
      dep.delay != null ? Number(dep.delay) : minutesBetween(dep.estimated ?? dep.actual, dep.scheduled),
    arrivalDelayMinutes:
      arr.delay != null ? Number(arr.delay) : minutesBetween(arr.estimated ?? arr.actual, arr.scheduled),
    source: 'aviationstack',
  };
}

// ── AeroDataBox (RapidAPI) ───────────────────────────────────────────────────

async function fetchAeroDataBox(key, iata, date) {
  const day = (date && String(date).slice(0, 10)) || new Date().toISOString().slice(0, 10);
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(iata)}/${day}`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`AeroDataBox ${res.status}`);
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return null;

  const dep = row.departure ?? {};
  const arr = row.arrival ?? {};
  const depSched = dep.scheduledTime?.utc ?? dep.scheduledTime?.local ?? null;
  const depAct = dep.runwayTime?.utc ?? dep.actualTime?.utc ?? null;
  const depEst = dep.revisedTime?.utc ?? dep.predictedTime?.utc ?? null;
  const arrSched = arr.scheduledTime?.utc ?? arr.scheduledTime?.local ?? null;
  const arrAct = arr.runwayTime?.utc ?? arr.actualTime?.utc ?? null;
  const arrEst = arr.revisedTime?.utc ?? arr.predictedTime?.utc ?? null;

  return {
    flightStatus: (row.status ?? 'unknown').toLowerCase(),
    airline: row.airline?.name ?? null,
    flightNumber: row.number ?? iata,
    departureAirport: dep.airport?.iata ?? null,
    arrivalAirport: arr.airport?.iata ?? null,
    scheduledDeparture: depSched,
    estimatedDeparture: depEst,
    actualDeparture: depAct,
    scheduledArrival: arrSched,
    estimatedArrival: arrEst,
    actualArrival: arrAct,
    departureTerminal: dep.terminal ?? null,
    departureGate: dep.gate ?? null,
    arrivalTerminal: arr.terminal ?? null,
    arrivalGate: arr.gate ?? null,
    departureDelayMinutes: minutesBetween(depEst ?? depAct, depSched),
    arrivalDelayMinutes: minutesBetween(arrEst ?? arrAct, arrSched),
    source: 'aerodatabox',
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await guard(req, res);
  if (!user) return;

  const { flightNumber, date } = req.body ?? {};
  const { iata } = parseFlightNumber(flightNumber);
  if (!iata) {
    return res.status(400).json({ error: 'A valid flight number is required (e.g. DL123).' });
  }

  const aviationKey = process.env.AVIATIONSTACK_API_KEY;
  const aeroKey = process.env.AERODATABOX_RAPIDAPI_KEY;

  if (!aviationKey && !aeroKey) {
    return res.status(200).json({
      configured: false,
      message: 'Flight tracking is not set up. Add AVIATIONSTACK_API_KEY (or AERODATABOX_RAPIDAPI_KEY) to enable live status.',
    });
  }

  try {
    let status = null;
    if (aviationKey) {
      status = await fetchAviationStack(aviationKey, iata, date);
    }
    if (!status && aeroKey) {
      status = await fetchAeroDataBox(aeroKey, iata, date);
    }

    if (!status) {
      return res.status(200).json({
        configured: true,
        found: false,
        message: `No live data found for flight ${iata}${date ? ` on ${String(date).slice(0, 10)}` : ''}.`,
      });
    }

    return res.status(200).json({ configured: true, found: true, status });
  } catch (err) {
    console.error('[flight-status]', err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? 'Flight status lookup failed' });
  }
};
