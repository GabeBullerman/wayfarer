// Shared Firebase Admin initializer for serverless API routes.
// Set FIREBASE_SERVICE_ACCOUNT in the environment to the service-account JSON
// (raw JSON or base64). Returns null when not configured so callers can
// degrade gracefully instead of crashing.
const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps && admin.apps.length) return admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (_) {
    try {
      creds = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (_) {
      return null;
    }
  }

  // Private keys pasted into env often have literal \n — normalize them.
  if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');

  try {
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    return admin;
  } catch (_) {
    return null;
  }
}

/** Firestore Timestamp (admin or plain) → ISO string, or null. */
function toIso(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts._seconds != null) return new Date(ts._seconds * 1000).toISOString();
  return null;
}

module.exports = { getAdmin, toIso };
