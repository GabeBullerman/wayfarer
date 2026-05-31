# Wayfarer — Feature Roadmap & Suggested Enhancements

Current stack: Angular 21 standalone + Firebase (Firestore, Auth, Storage) + Angular Material 3 + Google Maps API.

---

## 1. AI Travel Assistant

Integrate an LLM (Claude API or OpenAI) surfaced as a chat panel or contextual suggestion cards throughout the app.

**What it could do**
- General trip advice: "What should I know about traveling to Japan in March?"
- Packing list generation based on destination, trip dates, and weather forecast
- Day-by-day itinerary suggestions given a destination and trip length
- Smart budget estimates based on destination + travel style
- Local customs, tipping norms, safety advisories

**Implementation notes**
- Firebase Cloud Function as a thin proxy to the LLM API (keeps keys server-side)
- Store conversation history per trip in Firestore so context persists across sessions
- Surface suggestions inline: e.g., a "Get packing suggestions" button on the trip detail page that pre-fills context (destination, dates, traveler count)
- Consider prompt caching (Anthropic's cache_control) for system prompts to cut cost on repeat calls

---

## 2. Email Scraping for Bookings & Expenses

Automatically parse confirmation emails (flights, hotels, rental cars, restaurant reservations) and add them as bookings or expenses.

**Approach A — Gmail API (easiest if users have Google accounts)**
- OAuth 2.0 scope: `gmail.readonly`
- Query for emails matching known sender patterns: `from:@booking.com`, `from:@airbnb.com`, `from:@united.com`, etc.
- Parse structured data (confirmation numbers, dates, amounts) with regex or a lightweight LLM extraction call
- Present parsed results to the user for one-click confirmation before saving to Firestore

**Approach B — Forward-to-inbox**
- Give each trip a unique inbound email address (e.g., via SendGrid Inbound Parse or Postmark)
- User forwards confirmation emails to that address; a Cloud Function parses and ingests them
- No OAuth required — lower friction, works with any email provider

**What gets extracted**
- Booking type, vendor, confirmation number, dates, location, total cost
- Auto-creates a booking record and an expense entry linked to the same trip

---

## 3. Expense Tracking with Bank / Card Integration

Automatically pull transactions that occurred during a trip and match them to destinations.

**Plaid integration (most practical)**
- Plaid Link lets users connect a bank or credit card account in a few clicks
- Pull transactions for the trip date range, filtered by merchant location (Plaid returns lat/lng for many transactions)
- Auto-categorize (food, transport, lodging, entertainment) using Plaid's existing categories
- Flag unrecognized charges for user review
- Show a spend-by-category breakdown on the trip's Costs tab

**Implementation notes**
- Plaid tokens should be stored encrypted in Firestore; never expose them client-side
- A Cloud Function handles all Plaid API calls and returns only sanitized transaction data to the frontend
- Transactions can be linked to itinerary stops on the map for a "spent here" overlay

---

## 4. AI-Powered Card Flagging Prevention Reminders

One of the most common travel frustrations is a card getting blocked for unusual foreign activity. This feature would proactively address it.

**How it works**
1. When a trip is finalized (dates + destination confirmed), trigger a notification flow
2. AI generates a plain-English summary: "You're traveling to France, Italy, and Spain from June 10–24. You'll want to notify your card issuers before you go."
3. App surfaces bank-specific deep links or phone numbers for the cards the user has on file (sourced from Plaid metadata or manually entered)
4. One-tap "Set travel notice" that opens the bank's app or website at the right page, or initiates a notification email to the user as a reminder
5. Optionally, send a push notification 48 hours before departure as a final reminder

**Extensions**
- After a declined transaction is detected via Plaid, show a contextual in-app alert with the card issuer's contact number
- AI tip: "Visa cards issued by Chase don't require travel notices — only your Amex does"

---

## 5. Weather Integration

Pull forecast data for each destination and surface it on the trip overview and packing suggestions.

- OpenWeatherMap or WeatherAPI (free tiers are generous)
- Show a 7-day forecast widget on the trip detail Overview tab
- Feed current forecast into the AI packing list prompt for context-aware suggestions ("It will be 35°C and humid — pack lightweight breathable clothing")

---

## 6. Document Vault

Let users upload and organize travel documents per trip.

- Passports, visas, insurance cards, vaccine records, hotel confirmations
- Stored in Firebase Storage with per-user access rules
- Quick-access from the trip detail page — no digging through email while at a border crossing
- Optional: AI extraction of expiry dates, visa validity, and proactive alerts ("Your passport expires 2 months after your trip — some countries require 6 months validity")

---

## 7. Collaborative Trips

Allow multiple users to view and edit the same trip.

- Firestore already supports real-time multi-user updates
- Add an `invites` subcollection per trip; invited users get read or edit access based on role
- Show collaborator avatars on the trip card
- Real-time presence indicator on the itinerary timeline ("Sarah is editing Day 3")

---

## 8. Offline Support & PWA

Trips should be accessible without signal — airports, remote areas, international roaming.

- `@angular/service-worker` for caching the app shell and static assets
- Firestore offline persistence (already supported natively) for trip data
- Mark the app as a PWA (`manifest.webmanifest`) so it can be installed to the home screen on mobile
- Queue expense entries and itinerary edits made offline and sync when connectivity returns

---

## Priority Order (suggested)

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 1 | AI Travel Assistant | Medium | High |
| 2 | Weather Integration | Low | Medium |
| 3 | Email Scraping (Gmail API) | Medium | High |
| 4 | Card Flagging Reminders | Low–Medium | High |
| 5 | Document Vault | Low | Medium |
| 6 | Bank / Plaid Integration | High | High |
| 7 | Collaborative Trips | Medium | Medium |
| 8 | Offline / PWA | Medium | Medium |

---

## Notes

- All LLM and third-party API keys should live in Firebase Remote Config or Cloud Function environment variables — never in `environment.ts` which gets bundled into the client
- Plaid and Gmail OAuth require a backend; Firebase Cloud Functions (Node 20) are the natural fit given the existing stack
- For the AI assistant, start with a simple Cloud Function proxy before investing in conversation history — validate the UX first
