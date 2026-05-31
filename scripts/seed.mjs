import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import * as readline from 'readline';

const firebaseConfig = {
  apiKey: 'AIzaSyBK6tTKblKBaqwRj0zd7tRcNr_7LWrHW_k',
  authDomain: 'voya-43d55.firebaseapp.com',
  projectId: 'voya-43d55',
  storageBucket: 'voya-43d55.firebasestorage.app',
  messagingSenderId: '87454059861',
  appId: '1:87454059861:web:2894a2951fc02f496c33dc',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

function day(base, offsetDays, hours = 0, minutes = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hours, minutes, 0, 0);
  return Timestamp.fromDate(d);
}

async function seed(userId) {
  const start = new Date('2026-07-12');
  const end   = new Date('2026-07-20'); // 9 nights

  // ── Trip ──────────────────────────────────────────────────────────────────
  console.log('Creating trip...');
  const tripRef = await addDoc(collection(db, 'trips'), {
    userId,
    name: 'Bullerman Family Barcelona',
    destination: 'Barcelona, Spain',
    description: 'A Bullerman family reunion in Barcelona — Gaudí, tapas, beaches, and a whole lot of us.',
    startDate: Timestamp.fromDate(start),
    endDate:   Timestamp.fromDate(end),
    currency: 'EUR',
    coverPhotoUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=80&w=1200&auto=format&fit=crop',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  const tripId = tripRef.id;
  console.log(`  Trip: ${tripId}`);

  // ── Participants ──────────────────────────────────────────────────────────
  console.log('\nCreating participants...');

  const peopleData = [
    { name: 'Kari Bullerman',  homeCity: 'Kansas City, MO', isOrganizer: true  },
    { name: 'Gabe Bullerman',  homeCity: 'Denver, CO',       isOrganizer: false },
    { name: 'Maggie Bullerman',homeCity: 'Denver, CO',       isOrganizer: false },
    { name: 'Ben Bullerman',   homeCity: 'Des Moines, IA',   isOrganizer: false },
    { name: 'Seth Bullerman',  homeCity: 'Denver, CO',       isOrganizer: false },
    { name: 'Grace Bullerman', homeCity: 'Des Moines, IA',   isOrganizer: false },
    { name: 'Delta Bullerman', homeCity: 'Denver, CO',       isOrganizer: false },
    { name: 'Jean Cooke',      homeCity: 'Nashville, TN',    isOrganizer: false },
    { name: 'Daniel Baker',    homeCity: 'Denver, CO',       isOrganizer: false },
  ];

  const ids = {};
  for (const p of peopleData) {
    const ref = await addDoc(collection(db, 'participants'), {
      tripId,
      name: p.name,
      homeCity: p.homeCity,
      isOrganizer: p.isOrganizer,
      createdAt: Timestamp.now(),
    });
    ids[p.name] = ref.id;
    console.log(`  ${p.isOrganizer ? '★' : ' '} ${p.name} (${p.homeCity})`);
  }

  const kariId    = ids['Kari Bullerman'];
  const gabeId    = ids['Gabe Bullerman'];
  const maggieId  = ids['Maggie Bullerman'];
  const benId     = ids['Ben Bullerman'];
  const sethId    = ids['Seth Bullerman'];
  const graceId   = ids['Grace Bullerman'];
  const deltaId   = ids['Delta Bullerman'];
  const jeanId    = ids['Jean Cooke'];
  const danielId  = ids['Daniel Baker'];

  const everyone  = Object.values(ids);
  const colorado  = [gabeId, maggieId, sethId, deltaId, danielId];
  const iowa      = [benId, graceId];

  // ── Bookings (Kari pays all flights + hotel) ──────────────────────────────
  console.log('\nCreating bookings...');

  const bookings = [
    // ── OUTBOUND FLIGHTS ─────────────────────────────────────────────────────
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'United DEN → BCN (Colorado group)',
      provider: 'United Airlines',
      confirmationNumber: 'UA-773DEN',
      bookingUrl: 'https://united.com',
      checkIn:  day(start, 0),
      checkOut: day(start, 0),
      cost: 4250, currency: 'USD',   // 5 × $850
      notes: 'Nonstop via Frankfurt. Departs 10:15 AM, arrives July 13 07:30 AM BCN.',
      passengerIds: colorado,
      paidById: kariId,
      createdAt: Timestamp.now(),
    },
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'American DSM → BCN (Ben & Grace)',
      provider: 'American Airlines',
      confirmationNumber: 'AA-554DSM',
      bookingUrl: 'https://aa.com',
      checkIn:  day(start, 0),
      checkOut: day(start, 0),
      cost: 1760, currency: 'USD',   // 2 × $880
      notes: 'Connects through Philadelphia (PHL). Departs 8:45 AM.',
      passengerIds: iowa,
      paidById: kariId,
      createdAt: Timestamp.now(),
    },
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'Delta BNA → BCN (Jean)',
      provider: 'Delta Air Lines',
      confirmationNumber: 'DL-291BNA',
      bookingUrl: 'https://delta.com',
      checkIn:  day(start, 0),
      checkOut: day(start, 0),
      cost: 920, currency: 'USD',
      notes: 'Connects through JFK. Departs 7:20 AM.',
      passengerIds: [jeanId],
      paidById: kariId,
      createdAt: Timestamp.now(),
    },
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'Southwest MCI → BCN (Kari)',
      provider: 'Southwest / Iberia',
      confirmationNumber: 'IB-880MCI',
      bookingUrl: 'https://iberia.com',
      checkIn:  day(start, 0),
      checkOut: day(start, 0),
      cost: 890, currency: 'USD',
      notes: 'Southwest to Chicago, then Iberia ORD → BCN. Departs 6:50 AM.',
      passengerIds: [kariId],
      paidById: kariId,
      createdAt: Timestamp.now(),
    },

    // ── RETURN FLIGHTS ────────────────────────────────────────────────────────
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'United BCN → DEN (Colorado group)',
      provider: 'United Airlines',
      confirmationNumber: 'UA-774DEN',
      bookingUrl: 'https://united.com',
      checkIn:  day(start, 8),
      checkOut: day(start, 8),
      cost: 4000, currency: 'USD',   // 5 × $800
      notes: 'Return flight. Departs 11:20 AM, arrives same day 3:45 PM DEN.',
      passengerIds: colorado,
      paidById: kariId,
      createdAt: Timestamp.now(),
    },
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'American BCN → DSM (Ben & Grace)',
      provider: 'American Airlines',
      confirmationNumber: 'AA-555DSM',
      bookingUrl: 'https://aa.com',
      checkIn:  day(start, 8),
      checkOut: day(start, 8),
      cost: 1680, currency: 'USD',   // 2 × $840
      notes: 'Return through PHL. Arrives Des Moines evening.',
      passengerIds: iowa,
      paidById: kariId,
      createdAt: Timestamp.now(),
    },
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'Delta BCN → BNA (Jean)',
      provider: 'Delta Air Lines',
      confirmationNumber: 'DL-292BNA',
      bookingUrl: 'https://delta.com',
      checkIn:  day(start, 8),
      checkOut: day(start, 8),
      cost: 870, currency: 'USD',
      notes: 'Return via JFK.',
      passengerIds: [jeanId],
      paidById: kariId,
      createdAt: Timestamp.now(),
    },
    {
      tripId, type: 'flight', status: 'confirmed',
      title: 'Iberia BCN → MCI (Kari)',
      provider: 'Iberia / Southwest',
      confirmationNumber: 'IB-881MCI',
      bookingUrl: 'https://iberia.com',
      checkIn:  day(start, 8),
      checkOut: day(start, 8),
      cost: 850, currency: 'USD',
      notes: 'Return Iberia to ORD, Southwest to MCI.',
      passengerIds: [kariId],
      paidById: kariId,
      createdAt: Timestamp.now(),
    },

    // ── ACCOMMODATION ─────────────────────────────────────────────────────────
    {
      tripId, type: 'hotel', status: 'confirmed',
      title: 'Hotel Arts Barcelona — 4 rooms, 8 nights',
      provider: 'Hotel Arts',
      confirmationNumber: 'HA-BCN2026',
      bookingUrl: 'https://hotelartsbarcelona.com',
      checkIn:  day(start, 0),
      checkOut: day(start, 8),
      cost: 11520, currency: 'EUR',  // 4 rooms × €360/night × 8 nights
      notes: '4 sea-view rooms reserved: Kari solo, Gabe+Jean, Ben+Grace, Seth+Delta, Maggie+Daniel share the 4th. Free cancellation until July 5.',
      passengerIds: everyone,
      paidById: kariId,
      createdAt: Timestamp.now(),
    },

    // ── TRANSPORT ─────────────────────────────────────────────────────────────
    {
      tripId, type: 'car-rental', status: 'confirmed',
      title: 'Sixt — 2× Minivans (9 pax)',
      provider: 'Sixt',
      confirmationNumber: 'SX-MNBCN9',
      checkIn:  day(start, 1),
      checkOut: day(start, 7),
      cost: 1440, currency: 'EUR',   // 2 vans × €90/day × 8 days
      notes: '2× 9-seat Mercedes Vito. Pick up at El Prat. Full tank return required.',
      passengerIds: everyone,
      paidById: null,               // group split
      createdAt: Timestamp.now(),
    },
  ];

  for (const b of bookings) {
    await addDoc(collection(db, 'bookings'), b);
    const pax = b.passengerIds.length === everyone.length ? 'all 9' : `${b.passengerIds.length} pax`;
    console.log(`  ${b.title} (${pax})`);
  }

  // ── Itinerary (each person pays their own food/activities) ─────────────────
  console.log('\nCreating schedule...');

  const items = [
    // ─ Day 1: Arrival (July 12) ────────────────────────────────────────────
    { order: 1, date: day(start, 0), startTime: '15:00', endTime: '16:30',
      category: 'transport', title: 'Arrivals — El Prat Airport',
      location: 'Barcelona El Prat Airport', latitude: 41.2974, longitude: 2.0833,
      cost: null, currency: 'EUR',
      description: 'Different flights land throughout the afternoon. Group meets at Terminal 1 arrivals.',
      notes: 'Colorado group arrives ~07:30, others stagger through noon–15:00. Aerobus to Passeig de Gràcia (~35 min).' },

    { order: 2, date: day(start, 0), startTime: '17:00', endTime: '18:30',
      category: 'accommodation', title: 'Check in — Hotel Arts',
      location: 'Hotel Arts Barcelona, Carrer de la Marina 19',
      latitude: 41.3872, longitude: 2.1971,
      cost: null, currency: 'EUR',
      description: 'Check into 4 rooms. Drop bags, freshen up.',
      notes: 'Room list: Kari solo, Gabe+Jean, Ben+Grace, Seth+Delta, Maggie+Daniel (Kari booked 4 rooms — Maggie & Daniel share with someone).' },

    { order: 3, date: day(start, 0), startTime: '20:30', endTime: '23:00',
      category: 'food', title: 'Welcome dinner — El Nacional',
      location: 'El Nacional, Passeig de Gràcia 24',
      latitude: 41.3909, longitude: 2.1684,
      cost: 45, currency: 'EUR',
      description: 'Grand food hall with four restaurants under one roof. Everyone orders and pays their own.',
      notes: 'Reservation under Bullerman for 9. Try the Catalan dishes in the main hall.' },

    // ─ Day 2: Gaudí Day (July 13) ─────────────────────────────────────────
    { order: 1, date: day(start, 1), startTime: '09:00', endTime: '12:30',
      category: 'activity', title: 'Sagrada Família (group ticket)',
      location: 'Sagrada Família, Carrer de Mallorca 401',
      latitude: 41.4036, longitude: 2.1744,
      cost: 26, currency: 'EUR',
      description: 'Timed entry booked for all 9. Towers add-on recommended.',
      notes: 'Each person buys their own ticket at checkout — Kari reserved the time slot.' },

    { order: 2, date: day(start, 1), startTime: '13:30', endTime: '15:00',
      category: 'food', title: 'Lunch — Bar Calders (Sant Antoni)',
      location: 'Bar Calders, Carrer del Parlament 25',
      latitude: 41.3779, longitude: 2.1643,
      cost: 18, currency: 'EUR',
      description: 'Classic tapas bar. Split into a couple tables — everyone pays their own.',
      notes: 'Order patatas bravas, croquetas, pan con tomate.' },

    { order: 3, date: day(start, 1), startTime: '16:30', endTime: '19:00',
      category: 'activity', title: 'Park Güell',
      location: 'Park Güell, Carrer d\'Olot', latitude: 41.4145, longitude: 2.1527,
      cost: 10, currency: 'EUR',
      description: 'Mosaic terraces and panoramic city views. Timed entry.',
      notes: 'Book slots in advance — monument zone requires ticket.' },

    { order: 4, date: day(start, 1), startTime: '21:00', endTime: '23:00',
      category: 'food', title: 'Dinner — Bodega Sepúlveda',
      location: 'Carrer de Sepúlveda 173, Barcelona',
      latitude: 41.3831, longitude: 2.1567,
      cost: 25, currency: 'EUR',
      description: 'Relaxed neighborhood wine bar. Everyone pays own.',
      notes: '' },

    // ─ Day 3: Gothic Quarter + Beach (July 14) ────────────────────────────
    { order: 1, date: day(start, 2), startTime: '10:00', endTime: '12:30',
      category: 'activity', title: 'Gothic Quarter Walking Tour',
      location: 'Barri Gòtic, Barcelona', latitude: 41.3826, longitude: 2.1769,
      cost: 18, currency: 'EUR',
      description: 'Guided walk through medieval streets, Roman ruins, and the cathedral.',
      notes: 'Meet guide at Plaça Nova at 10:00 sharp.' },

    { order: 2, date: day(start, 2), startTime: '13:00', endTime: '14:30',
      category: 'food', title: 'Lunch — La Pepita (bocadillos)',
      location: 'La Pepita, Carrer de Montserrat 9',
      latitude: 41.3835, longitude: 2.1742,
      cost: 12, currency: 'EUR',
      description: 'Famous smashed bocadillo sandwiches. Quick lunch before the beach.',
      notes: 'Expect a line — worth it.' },

    { order: 3, date: day(start, 2), startTime: '15:30', endTime: '19:30',
      category: 'activity', title: 'Barceloneta Beach afternoon',
      location: 'Barceloneta Beach', latitude: 41.3793, longitude: 2.1897,
      cost: null, currency: 'EUR',
      description: 'Free afternoon at the beach. Paddleball, swim, sunbathe.',
      notes: 'Rent beach chairs if needed (~€5/chair).' },

    { order: 4, date: day(start, 2), startTime: '21:00', endTime: '23:00',
      category: 'food', title: 'Dinner — La Mar Salada (seafood)',
      location: 'La Mar Salada, Passeig de Joan de Borbó 58',
      latitude: 41.3779, longitude: 2.1867,
      cost: 40, currency: 'EUR',
      description: 'Fresh seafood right on the waterfront. Everyone pays own.',
      notes: 'Get the fideuà and grilled prawns.' },

    // ─ Day 4: Montserrat Day Trip (July 15) ───────────────────────────────
    { order: 1, date: day(start, 3), startTime: '08:30', endTime: '09:30',
      category: 'transport', title: 'Drive to Montserrat (minivans)',
      location: 'A2 Highway toward Montserrat', latitude: 41.4933, longitude: 1.9510,
      cost: null, currency: 'EUR',
      description: '~1 hour drive from Hotel Arts. Both vans leave together.',
      notes: 'Park at lower station and take the rack railway up.' },

    { order: 2, date: day(start, 3), startTime: '09:30', endTime: '13:00',
      category: 'activity', title: 'Montserrat Monastery & Hike',
      location: 'Montserrat, Catalonia', latitude: 41.5928, longitude: 1.8350,
      cost: 12, currency: 'EUR',
      description: 'Visit the basilica, see the Black Madonna, hike the Sant Joan trail for views.',
      notes: 'Each person pays rack railway separately (~€12). Bring hiking shoes and water.' },

    { order: 3, date: day(start, 3), startTime: '13:30', endTime: '14:30',
      category: 'food', title: 'Lunch at Montserrat cafeteria',
      location: 'Montserrat Mountain Restaurant',
      latitude: 41.5930, longitude: 1.8340,
      cost: 16, currency: 'EUR',
      description: 'Simple Catalan lunch at the mountain cafeteria. Everyone pays own.',
      notes: '' },

    { order: 4, date: day(start, 3), startTime: '17:00', endTime: '18:00',
      category: 'transport', title: 'Drive back to Barcelona',
      location: 'Hotel Arts Barcelona', latitude: 41.3872, longitude: 2.1971,
      cost: null, currency: 'EUR', description: '', notes: '' },

    { order: 5, date: day(start, 3), startTime: '20:30', endTime: '22:30',
      category: 'food', title: 'Dinner — Cervecería Catalana',
      location: 'Cervecería Catalana, Carrer de Mallorca 236',
      latitude: 41.3930, longitude: 2.1620,
      cost: 28, currency: 'EUR',
      description: 'Bustling tapas bar, perfect after a long day. Everyone pays own.',
      notes: 'No reservations — arrive early or expect a wait.' },

    // ─ Day 5: Gràcia + Casa Batlló (July 16) ─────────────────────────────
    { order: 1, date: day(start, 4), startTime: '10:00', endTime: '13:00',
      category: 'activity', title: 'Casa Batlló',
      location: 'Casa Batlló, Passeig de Gràcia 43',
      latitude: 41.3917, longitude: 2.1649,
      cost: 35, currency: 'EUR',
      description: 'Gaudí\'s most theatrical building. Magic Nights optional add-on.',
      notes: 'Book timed entry in advance. Each person pays own.' },

    { order: 2, date: day(start, 4), startTime: '13:30', endTime: '15:00',
      category: 'food', title: 'Lunch — Gràcia neighborhood',
      location: 'Plaça de la Vila de Gràcia', latitude: 41.4029, longitude: 2.1558,
      cost: 15, currency: 'EUR',
      description: 'Explore the charming squares of Gràcia and pick your own spot for lunch.',
      notes: 'Great area for pintxos bars and casual Mediterranean food.' },

    { order: 3, date: day(start, 4), startTime: '16:00', endTime: '19:00',
      category: 'activity', title: 'Free afternoon — shopping on Passeig de Gràcia',
      location: 'Passeig de Gràcia', latitude: 41.3954, longitude: 2.1619,
      cost: null, currency: 'EUR',
      description: 'Unstructured time — shopping, coffee, exploring.',
      notes: 'Block of Discord: Casa Batlló, Casa Amatller, Casa Lleó i Morera all on same block.' },

    { order: 4, date: day(start, 4), startTime: '20:00', endTime: '22:30',
      category: 'food', title: 'Dinner — Tickets (Albert Adrià)',
      location: 'Tickets, Avinguda del Paral·lel 164',
      latitude: 41.3756, longitude: 2.1568,
      cost: 65, currency: 'EUR',
      description: 'Avant-garde tapas from the Adrià family. One of Barcelona\'s hottest restaurants.',
      notes: 'Reservation ESSENTIAL — book 2 months ahead. Each person pays own.' },

    // ─ Day 6: El Born + Picasso Museum (July 17) ──────────────────────────
    { order: 1, date: day(start, 5), startTime: '10:00', endTime: '13:00',
      category: 'activity', title: 'Picasso Museum',
      location: 'Museu Picasso, Carrer de Montcada 15–23',
      latitude: 41.3853, longitude: 2.1803,
      cost: 14, currency: 'EUR',
      description: 'World-class collection tracing Picasso\'s early years. Book in advance.',
      notes: 'Free first Sunday of each month — July 5 was the last one.' },

    { order: 2, date: day(start, 5), startTime: '13:30', endTime: '15:00',
      category: 'food', title: 'Lunch — El Born tapas crawl',
      location: 'El Born neighborhood', latitude: 41.3844, longitude: 2.1825,
      cost: 20, currency: 'EUR',
      description: 'Wander the El Born streets and graze at multiple tapas bars.',
      notes: 'Try Bar del Pla and El Xampanyet for house cava.' },

    { order: 3, date: day(start, 5), startTime: '15:30', endTime: '17:00',
      category: 'activity', title: 'La Boqueria Market',
      location: 'La Boqueria, La Rambla 91', latitude: 41.3817, longitude: 2.1714,
      cost: null, currency: 'EUR',
      description: 'Browse (or shop) the famous covered market. Great for snacks and gifts.',
      notes: 'Don\'t eat at the touristy stalls inside — better to pick up fresh fruit and jamón.' },

    { order: 4, date: day(start, 5), startTime: '20:30', endTime: '23:30',
      category: 'food', title: 'Group farewell dinner — Cinc Sentits',
      location: 'Cinc Sentits, Carrer d\'Entença 60',
      latitude: 41.3879, longitude: 2.1580,
      cost: 120, currency: 'EUR',
      description: 'Michelin-starred Catalan tasting menu. The big family dinner.',
      notes: 'Reservation for 9. Everyone pays their own tasting menu — ~€120pp. One of the best meals in Barcelona.' },

    // ─ Day 7: Tibidabo + Nightlife (July 18) ─────────────────────────────
    { order: 1, date: day(start, 6), startTime: '10:30', endTime: '14:00',
      category: 'activity', title: 'Tibidabo Amusement Park',
      location: 'Parc d\'Atraccions Tibidabo', latitude: 41.4219, longitude: 2.1180,
      cost: 35, currency: 'EUR',
      description: 'Hilltop amusement park with incredible city and sea views. Classic Barcelona experience.',
      notes: 'Take FGC train from Plaça Catalunya + Tramvia Blau + funicular.' },

    { order: 2, date: day(start, 6), startTime: '14:30', endTime: '16:00',
      category: 'food', title: 'Lunch with a view — Miramar',
      location: 'Mirador del Migdia, Montjuïc', latitude: 41.3614, longitude: 2.1476,
      cost: 30, currency: 'EUR',
      description: 'Casual lunch spot on Montjuïc with panoramic harbor views.',
      notes: '' },

    { order: 3, date: day(start, 6), startTime: '22:00', endTime: null,
      category: 'activity', title: 'Night out — El Born & Barceloneta clubs',
      location: 'El Born, Barcelona', latitude: 41.3850, longitude: 2.1830,
      cost: null, currency: 'EUR',
      description: 'For those who want to experience Barcelona nightlife. Optional.',
      notes: 'Barcelona nightlife starts late — 11pm is early. Pacha and Opium near the beach are popular.' },

    // ─ Day 8: Sitges Day Trip (July 19) ───────────────────────────────────
    { order: 1, date: day(start, 7), startTime: '09:30', endTime: '10:15',
      category: 'transport', title: 'Drive to Sitges',
      location: 'Sitges, Catalonia', latitude: 41.2369, longitude: 1.8054,
      cost: null, currency: 'EUR',
      description: 'Beautiful coastal town 40 min south of Barcelona by car.',
      notes: 'Take C-32 motorway. Park near the old town.' },

    { order: 2, date: day(start, 7), startTime: '10:30', endTime: '14:30',
      category: 'activity', title: 'Sitges — beach, old town & church',
      location: 'Sitges old town', latitude: 41.2369, longitude: 1.8054,
      cost: null, currency: 'EUR',
      description: 'Explore the whitewashed old town, Church of Sant Bartomeu, and the gorgeous beach.',
      notes: 'Much less crowded than Barceloneta.' },

    { order: 3, date: day(start, 7), startTime: '14:30', endTime: '16:00',
      category: 'food', title: 'Seafood lunch in Sitges',
      location: 'El Pou, Carrer de Sant Pau 5, Sitges',
      latitude: 41.2362, longitude: 1.8065,
      cost: 35, currency: 'EUR',
      description: 'Fresh grilled seafood overlooking the water. Everyone pays own.',
      notes: '' },

    { order: 4, date: day(start, 7), startTime: '19:00', endTime: '20:00',
      category: 'transport', title: 'Drive back to Barcelona',
      location: 'Hotel Arts Barcelona', latitude: 41.3872, longitude: 2.1971,
      cost: null, currency: 'EUR', description: '', notes: 'Last night — pack for tomorrow.' },

    { order: 5, date: day(start, 7), startTime: '21:00', endTime: '22:30',
      category: 'food', title: 'Last night dinner — Hotel Arts rooftop',
      location: 'Hotel Arts Barcelona Rooftop', latitude: 41.3872, longitude: 2.1971,
      cost: 55, currency: 'EUR',
      description: 'Low-key last supper at the hotel rooftop bar. Everyone pays own.',
      notes: 'Hotel guests get priority reservations — book through concierge.' },

    // ─ Day 9: Checkout & Flights (July 20) ────────────────────────────────
    { order: 1, date: day(start, 8), startTime: '07:30', endTime: '09:00',
      category: 'accommodation', title: 'Check out — Hotel Arts',
      location: 'Hotel Arts Barcelona', latitude: 41.3872, longitude: 2.1971,
      cost: null, currency: 'EUR',
      description: 'Check out by 11 AM. Luggage storage available if flights are later.',
      notes: '' },

    { order: 2, date: day(start, 8), startTime: '09:30', endTime: '10:30',
      category: 'food', title: 'Final coffee & pastries — Forn de Sant Jaume',
      location: 'Forn de Sant Jaume, Rambla de Catalunya 50',
      latitude: 41.3926, longitude: 2.1647,
      cost: 8, currency: 'EUR',
      description: 'Pick up croissants and café amb llet before heading to the airport.',
      notes: '' },

    { order: 3, date: day(start, 8), startTime: '11:00', endTime: '13:00',
      category: 'transport', title: 'Transfer to El Prat — all flights depart',
      location: 'Barcelona El Prat Airport', latitude: 41.2974, longitude: 2.0833,
      cost: null, currency: 'EUR',
      description: 'Both minivans to the airport. Drop off rental cars. International flights — arrive 3h early.',
      notes: 'Colorado group: Terminal 1 (United). Iowa group: Terminal 1 (American). Jean: Terminal 1 (Delta). Kari: Terminal 1 (Iberia).' },
  ];

  for (const item of items) {
    await addDoc(collection(db, 'itinerary'), {
      tripId, userId,
      title: item.title,
      date: item.date,
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      category: item.category,
      location: item.location ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      cost: item.cost ?? null,
      currency: item.currency,
      description: item.description ?? '',
      notes: item.notes ?? '',
      order: item.order,
    });
    console.log(`  ${item.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} [${item.category}] ${item.title}`);
  }

  console.log('\n✓ Done! "Bullerman Family Barcelona" seeded successfully.');
  console.log(`  Trip ID:      ${tripId}`);
  console.log(`  Participants: 9 (Kari + 8 family/partners)`);
  console.log(`  Bookings:     ${bookings.length} (4 outbound + 4 return flights, hotel, minivans)`);
  console.log(`  Schedule:     ${items.length} items across 9 days`);
  console.log(`  Kari's total flight spend: $15,220 USD`);
  console.log(`  Hotel spend: €11,520 EUR`);
}

async function main() {
  const email    = process.argv[2] || await prompt('Email: ');
  const password = process.argv[3] || await prompt('Password: ');

  console.log('Signing in...');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${cred.user.email}\n`);

  await seed(cred.user.uid);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
