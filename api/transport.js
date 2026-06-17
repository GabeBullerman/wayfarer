const Groq = require('groq-sdk');

const DB_API        = 'https://v6.db.transport.rest';
const OVERPASS      = 'https://overpass-api.de/api/interpreter';
const SKYSCRAPPER   = 'https://sky-scrapper.p.rapidapi.com';
const MAKCORPS      = 'https://makcorps.p.rapidapi.com';

// ── Deutsche Bahn helpers ─────────────────────────────────────────────────────

async function dbGet(path) {
  const res = await fetch(`${DB_API}${path}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`DB API ${res.status}: ${path}`);
  return res.json();
}

async function findStation(query) {
  const data = await dbGet(`/locations?query=${encodeURIComponent(query)}&results=3&stops=true&addresses=false&poi=false`);
  return data?.[0] ?? null;
}

async function searchJourneys(fromId, toId, departure, results = 5) {
  return dbGet(`/journeys?from=${fromId}&to=${toId}&departure=${encodeURIComponent(departure)}&results=${results}&language=en`);
}

async function getNearbyTransit(lat, lon, distance = 1500) {
  return dbGet(`/stops/nearby?latitude=${lat}&longitude=${lon}&distance=${distance}&results=20`);
}

// ── Overpass / local options ──────────────────────────────────────────────────

async function getLocalOptions(lat, lon) {
  const query = `[out:json][timeout:15];
(
  node["amenity"="bicycle_rental"](around:1500,${lat},${lon});
  node["amenity"="bicycle_parking"](around:1500,${lat},${lon});
  node["highway"="bus_stop"](around:1500,${lat},${lon});
  node["railway"="tram_stop"](around:1500,${lat},${lon});
  node["railway"="subway_entrance"](around:1500,${lat},${lon});
  node["amenity"="taxi"](around:1500,${lat},${lon});
  node["amenity"="car_rental"](around:2000,${lat},${lon});
  node["amenity"="car_sharing"](around:2000,${lat},${lon});
  node["amenity"="motorcycle_rental"](around:2000,${lat},${lon});
  node["amenity"="ferry_terminal"](around:3000,${lat},${lon});
);
out body 40;`;

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.elements ?? []).map(e => ({
    type: e.tags?.amenity ?? e.tags?.highway ?? e.tags?.railway ?? 'other',
    name: e.tags?.name ?? e.tags?.['name:en'] ?? null,
    lat:  e.lat,
    lon:  e.lon,
  }));
}

// ── Sky Scrapper (RapidAPI) — flight search ───────────────────────────────────

function rapidHeaders(apiKey, host) {
  return {
    'X-RapidAPI-Key':  apiKey,
    'X-RapidAPI-Host': host,
    'Accept':          'application/json',
  };
}

async function searchAirportSS(apiKey, query) {
  const url = `${SKYSCRAPPER}/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=en-US`;
  const res = await fetch(url, { headers: rapidHeaders(apiKey, 'sky-scrapper.p.rapidapi.com') });
  if (!res.ok) return null;
  const data = await res.json();
  const airports = data?.data ?? [];
  // prefer entries that look like airports (IATA codes are usually 3 uppercase chars)
  return airports.find(a => /^[A-Z]{3,4}$/.test(a.skyId ?? '')) ?? airports[0] ?? null;
}

async function searchFlightsSS(apiKey, originSkyId, destSkyId, originEntityId, destEntityId, date) {
  const params = new URLSearchParams({
    originSkyId,
    destinationSkyId:  destSkyId,
    originEntityId,
    destinationEntityId: destEntityId,
    date,
    adults:      '1',
    currency:    'USD',
    locale:      'en-US',
    market:      'en-US',
    countryCode: 'US',
  });
  const url = `${SKYSCRAPPER}/api/v2/flights/searchFlights?${params}`;
  const res = await fetch(url, { headers: rapidHeaders(apiKey, 'sky-scrapper.p.rapidapi.com') });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.status);
    throw new Error(`Sky Scrapper flights ${res.status}: ${txt}`);
  }
  return res.json();
}

function parseFlightsSS(data, originCode, destinationCode) {
  const itineraries = data?.data?.itineraries ?? [];
  return itineraries.slice(0, 6).map((it, idx) => {
    const leg      = it.legs?.[0] ?? {};
    const carrier  = leg.carriers?.marketing?.[0] ?? {};
    const price    = it.price ?? {};
    const dMin     = leg.durationInMinutes;

    return {
      id:              it.id ?? String(idx),
      departure:       leg.departure ?? null,
      arrival:         leg.arrival   ?? null,
      duration:        dMin ? `${Math.floor(dMin / 60)}h ${dMin % 60}m` : null,
      stops:           leg.stopCount ?? 0,
      airline:         carrier.name  ?? null,
      flightNumber:    leg.segments?.[0]?.flightNumber ?? '',
      originCode:      leg.origin?.displayCode      ?? originCode,
      destinationCode: leg.destination?.displayCode ?? destinationCode,
      price: price.raw != null ? {
        amount:   price.raw,
        currency: 'USD',
      } : null,
    };
  });
}

// ── Makcorps (RapidAPI) — hotel search ───────────────────────────────────────

async function lookupCityMakcorps(apiKey, cityName) {
  const url = `${MAKCORPS}/mapping?name=${encodeURIComponent(cityName)}`;
  const res = await fetch(url, { headers: rapidHeaders(apiKey, 'makcorps.p.rapidapi.com') });
  if (!res.ok) return null;
  const data = await res.json();
  const cities = Array.isArray(data) ? data : (data?.cities ?? data?.data ?? []);
  return cities[0] ?? null;
}

async function searchHotelsMakcorps(apiKey, cityId, checkIn, checkOut) {
  const params = new URLSearchParams({
    cityid:   String(cityId),
    checkin:  checkIn,
    checkout: checkOut,
    adults:   '2',
    rooms:    '1',
    cur:      'USD',
  });
  const url = `${MAKCORPS}/city?${params}`;
  const res = await fetch(url, { headers: rapidHeaders(apiKey, 'makcorps.p.rapidapi.com') });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.status);
    throw new Error(`Makcorps hotels ${res.status}: ${txt}`);
  }
  return res.json();
}

function parseHotelsMakcorps(data, checkIn, checkOut) {
  // Makcorps returns either an array at root or nested under a key
  const raw = Array.isArray(data) ? data
    : (data?.hotels ?? data?.data ?? data?.results ?? []);

  return raw.slice(0, 10).map((h, idx) => {
    // field names differ slightly between Makcorps plan tiers
    const name    = h.hotel_name ?? h.hotelName ?? h.name ?? 'Unknown Hotel';
    const id      = h.hotel_id   ?? h.hotelId   ?? h.id   ?? String(idx);
    const stars   = h.hotel_star_rating ?? h.stars ?? h.rating ?? null;
    const roomTxt = h.room_type  ?? h.roomType   ?? null;

    // price may be nested or flat
    const priceObj  = h.min_price ?? h.price ?? h.lowestPrice ?? null;
    const priceAmt  = typeof priceObj === 'number' ? priceObj
      : (priceObj?.price ?? priceObj?.amount ?? priceObj?.total ?? null);

    return {
      hotelId:   String(id),
      hotelName: name,
      cityCode:  '',
      checkIn,
      checkOut,
      price: priceAmt != null ? { amount: parseFloat(priceAmt), currency: 'USD' } : null,
      rating:    stars ? parseInt(stars, 10) : null,
      roomType:  roomTxt,
      boardType: h.board_type ?? h.boardType ?? null,
    };
  });
}

// ── Shared formatters ─────────────────────────────────────────────────────────

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function parseJourneys(data) {
  if (!data?.journeys) return [];
  return data.journeys.slice(0, 6).map(j => {
    const legs  = j.legs ?? [];
    const first = legs[0];
    const last  = legs[legs.length - 1];
    const depTime  = first?.plannedDeparture ?? first?.departure;
    const arrTime  = last?.plannedArrival    ?? last?.arrival;
    const durationMs  = depTime && arrTime ? new Date(arrTime) - new Date(depTime) : null;
    const durationMin = durationMs ? Math.round(durationMs / 60000) : null;
    const changes = legs.filter(l => l.walking !== true).length - 1;

    return {
      id: `${depTime}-${arrTime}`,
      departure: depTime,
      arrival:   arrTime,
      duration:  durationMin ? formatDuration(durationMin) : null,
      changes,
      legs: legs.map(l => ({
        mode:      l.line?.mode ?? (l.walking ? 'walking' : 'unknown'),
        name:      l.line?.name ?? l.line?.fahrtNr ?? null,
        product:   l.line?.product ?? null,
        from:      l.origin?.name ?? null,
        to:        l.destination?.name ?? null,
        departure: l.plannedDeparture ?? l.departure,
        arrival:   l.plannedArrival   ?? l.arrival,
      })),
      price: j.price ? { amount: j.price.amount, currency: j.price.currency } : null,
    };
  });
}

function summariseLocalOptions(elements) {
  const counts = {};
  for (const e of elements) {
    const label =
      e.type === 'bicycle_rental'    ? 'Bike Share'            :
      e.type === 'bus_stop'          ? 'Bus'                   :
      e.type === 'tram_stop'         ? 'Tram'                  :
      e.type === 'subway_entrance'   ? 'Subway / Metro'        :
      e.type === 'taxi'              ? 'Taxi Stand'            :
      e.type === 'car_rental'        ? 'Car Rental'            :
      e.type === 'car_sharing'       ? 'Car Sharing'           :
      e.type === 'motorcycle_rental' ? 'Scooter / Moto Rental' :
      e.type === 'ferry_terminal'    ? 'Ferry'                 : null;
    if (label) counts[label] = (counts[label] ?? 0) + 1;
  }
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, origin, destination, departure, lat, lon } = req.body ?? {};

  try {
    // ── Intercity train journeys (Deutsche Bahn) ──────────────────────────────
    if (action === 'search') {
      if (!origin || !destination || !departure) {
        return res.status(400).json({ error: 'Missing origin, destination, or departure' });
      }

      const [fromStation, toStation] = await Promise.all([
        findStation(origin),
        findStation(destination),
      ]);

      if (!fromStation) return res.status(200).json({ journeys: [], error: `Could not find station for "${origin}"` });
      if (!toStation)   return res.status(200).json({ journeys: [], error: `Could not find station for "${destination}"` });

      const data     = await searchJourneys(fromStation.id, toStation.id, departure);
      const journeys = parseJourneys(data);

      return res.status(200).json({
        journeys,
        fromStation: { id: fromStation.id, name: fromStation.name },
        toStation:   { id: toStation.id,   name: toStation.name },
      });
    }

    // ── Flight search (Sky Scrapper via RapidAPI) ─────────────────────────────
    if (action === 'flights') {
      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
      }

      const { flightOrigin, flightDestination, flightDate } = req.body;
      if (!flightOrigin || !flightDestination || !flightDate) {
        return res.status(400).json({ error: 'Missing flightOrigin, flightDestination, or flightDate' });
      }

      const [fromAirport, toAirport] = await Promise.all([
        searchAirportSS(apiKey, flightOrigin),
        searchAirportSS(apiKey, flightDestination),
      ]);

      if (!fromAirport) return res.status(200).json({ flights: [], error: `No airport found for "${flightOrigin}"` });
      if (!toAirport)   return res.status(200).json({ flights: [], error: `No airport found for "${flightDestination}"` });

      const dateStr = flightDate.slice(0, 10);
      const data    = await searchFlightsSS(
        apiKey,
        fromAirport.skyId,      toAirport.skyId,
        fromAirport.entityId,   toAirport.entityId,
        dateStr,
      );
      const flights = parseFlightsSS(data, fromAirport.skyId, toAirport.skyId);

      return res.status(200).json({
        flights,
        fromAirport: { code: fromAirport.skyId, name: fromAirport.presentation?.title ?? flightOrigin },
        toAirport:   { code: toAirport.skyId,   name: toAirport.presentation?.title   ?? flightDestination },
      });
    }

    // ── Local transport options (Overpass + DB nearby) ────────────────────────
    if (action === 'local') {
      if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

      const [transitStops, osmElements] = await Promise.all([
        getNearbyTransit(lat, lon, 1500).catch(() => []),
        getLocalOptions(lat, lon).catch(() => []),
      ]);

      const localSummary = summariseLocalOptions(osmElements);
      const nearbyStops  = (Array.isArray(transitStops) ? transitStops : [])
        .slice(0, 10)
        .map(s => ({ name: s.name, id: s.id, distance: s.distance, products: s.products }));

      return res.status(200).json({ localSummary, nearbyStops });
    }

    // ── AI transport plan (Groq) ──────────────────────────────────────────────
    if (action === 'plan') {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

      const { tripName, journeys, localSummary, destination: dest } = req.body;
      const groq = new Groq({ apiKey: groqKey });

      const context = [
        journeys?.length
          ? `Available trains: ${journeys.slice(0, 3).map(j =>
              `${j.departure ? new Date(j.departure).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '?'} → ${j.arrival ? new Date(j.arrival).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '?'} (${j.duration}, ${j.changes} change${j.changes !== 1 ? 's' : ''})`
            ).join(' | ')}`
          : 'No train results found.',
        localSummary?.length
          ? `Local transport at destination: ${localSummary.map(l => `${l.count} ${l.type} stop${l.count !== 1 ? 's' : ''}`).join(', ')}`
          : 'No local transport data available.',
      ].join('\n');

      const response = await groq.chat.completions.create({
        model:      'llama-3.3-70b-versatile',
        max_tokens: 512,
        messages: [
          { role: 'system', content: 'You are a concise European travel transport advisor. Give practical, specific advice in 3–5 bullet points. No fluff.' },
          { role: 'user',   content: `Trip: ${tripName ?? 'Unknown'} to ${dest ?? 'Unknown'}\n${context}\n\nGive a short transport plan: which train to take, and how to get around locally.` },
        ],
      });

      return res.status(200).json({ plan: response.choices[0].message.content });
    }

    // ── Hotel search (Makcorps via RapidAPI) ──────────────────────────────────
    if (action === 'hotels') {
      const apiKey = process.env.RAPIDAPI_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
      }

      const { hotelDestination, hotelCheckIn, hotelCheckOut } = req.body;
      if (!hotelDestination || !hotelCheckIn || !hotelCheckOut) {
        return res.status(400).json({ error: 'Missing hotelDestination, hotelCheckIn, or hotelCheckOut' });
      }

      const cityEntry = await lookupCityMakcorps(apiKey, hotelDestination);
      if (!cityEntry) {
        return res.status(200).json({ hotels: [], error: `Could not resolve city for "${hotelDestination}"` });
      }

      const cityId  = cityEntry.city_id ?? cityEntry.cityId ?? cityEntry.id;
      if (!cityId) {
        return res.status(200).json({ hotels: [], error: `No city ID found for "${hotelDestination}"` });
      }

      const checkIn  = hotelCheckIn.slice(0, 10);
      const checkOut = hotelCheckOut.slice(0, 10);

      const raw    = await searchHotelsMakcorps(apiKey, cityId, checkIn, checkOut);
      const hotels = parseHotelsMakcorps(raw, checkIn, checkOut);

      return res.status(200).json({ hotels });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[transport]', err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? 'Transport lookup failed' });
  }
};
