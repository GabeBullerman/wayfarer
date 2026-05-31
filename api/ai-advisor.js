const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured in Vercel environment variables.' });
  }

  const { type, trip, messages, existingItems } = req.body ?? {};
  if (!type || !trip) {
    return res.status(400).json({ error: 'Missing required fields: type, trip' });
  }

  const client = new Anthropic({ apiKey });

  const startDate = new Date(trip.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDate   = new Date(trip.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const durationDays = Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)) + 1;

  try {
    if (type === 'packing') {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: `You are a travel packing assistant. Return ONLY a valid JSON array of packing items — no markdown fences, no explanation. Each item must be an object with exactly these keys: "name" (string), "category" (one of: "documents", "clothing", "electronics", "toiletries", "medicine", "gear", "food", "other"), "quantity" (number).`,
        messages: [{
          role: 'user',
          content: `Trip: ${trip.name} to ${trip.destination}\nDuration: ${durationDays} days (${startDate} – ${endDate})\nAlready packing: ${existingItems?.length ? existingItems.join(', ') : 'nothing yet'}\n\nSuggest 20 essential items I haven't already listed. Focus on practical must-haves for this destination and trip length.`,
        }],
      });

      let suggestions = [];
      try {
        let text = response.content[0].text.trim();
        // Strip markdown fences if model included them despite instructions
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        suggestions = JSON.parse(text);
        if (!Array.isArray(suggestions)) suggestions = [];
      } catch (_) {
        suggestions = [];
      }

      return res.status(200).json({ suggestions });
    }

    if (type === 'chat') {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `You are a knowledgeable, friendly AI travel assistant built into the Wayfarer travel app.
The user is planning "${trip.name}" — a trip to ${trip.destination} from ${startDate} to ${endDate} (${durationDays} days).
Give concise, practical, personalised advice. Use short paragraphs or bullet points. Avoid generic filler.`,
        messages: (messages ?? []).map(m => ({ role: m.role, content: m.content })),
      });

      return res.status(200).json({ reply: response.content[0].text });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err) {
    console.error('[ai-advisor]', err?.message ?? err);
    return res.status(500).json({ error: 'AI request failed. Check server logs.' });
  }
};
