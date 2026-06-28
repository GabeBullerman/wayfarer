// Server-side invite acceptance. The client used to read the trip directly to
// verify the invite token, which required a broad Firestore read rule (any
// signed-in user could read any trip carrying an inviteToken). Doing it here
// with the Admin SDK lets us lock that rule down: the client never reads other
// trips — it just posts the invite slug and we add them if the token matches.
const { getAdmin } = require('./_firebaseAdmin');
const { FieldValue } = require('firebase-admin/firestore');
const { guard } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await guard(req, res);
  if (!user) return;

  const admin = getAdmin();
  if (!admin) return res.status(503).json({ error: 'Server is not configured.' });

  const slug = String((req.body ?? {}).slug ?? '').trim();
  const dot = slug.indexOf('.');
  if (dot === -1) return res.status(400).json({ error: 'Invalid invite link.' });

  const tripId = slug.slice(0, dot);
  const random = slug.slice(dot + 1);
  if (!tripId || !random) return res.status(400).json({ error: 'Invalid invite link.' });

  try {
    const db = admin.firestore();
    const ref = db.collection('trips').doc(tripId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'This invite is no longer valid.' });

    const trip = snap.data();
    // Constant token comparison isn't critical here (random 24-char token), but
    // reject any mismatch outright.
    if (!trip.inviteToken || trip.inviteToken !== random) {
      return res.status(403).json({ error: 'This invite link is invalid or has been revoked.' });
    }

    const uid = user.uid;
    const alreadyMember =
      trip.userId === uid ||
      (trip.ownerIds ?? []).includes(uid) ||
      (trip.collaboratorIds ?? []).includes(uid);

    if (!alreadyMember) {
      await ref.update({
        collaboratorIds: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.status(200).json({ tripId, tripName: trip.name ?? 'Trip', alreadyMember });
  } catch (err) {
    console.error('[accept-invite]', err?.message ?? err);
    return res.status(500).json({ error: 'Could not process the invite.' });
  }
};
