const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel environment variables.' });
  }

  const { type, trip, messages, existingItems } = req.body ?? {};
  if (!type || !trip) {
    return res.status(400).json({ error: 'Missing required fields: type, trip' });
  }

  const startDate = new Date(trip.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDate   = new Date(trip.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const durationDays = Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)) + 1;

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    if (type === 'packing') {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are a travel packing assistant. Return ONLY a valid JSON array of packing items — no markdown fences, no explanation. Each item must be an object with exactly these keys: "name" (string), "category" (one of: "documents", "clothing", "electronics", "toiletries", "medicine", "gear", "food", "other"), "quantity" (number).`,
      });

      const prompt = `Trip: ${trip.name} to ${trip.destination}\nDuration: ${durationDays} days (${startDate} – ${endDate})\nAlready packing: ${existingItems?.length ? existingItems.join(', ') : 'nothing yet'}\n\nSuggest 20 essential items I haven't already listed. Focus on practical must-haves for this destination and trip length.`;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      let suggestions = [];
      try {
        suggestions = JSON.parse(text);
        if (!Array.isArray(suggestions)) suggestions = [];
      } catch (_) {
        suggestions = [];
      }

      return res.status(200).json({ suggestions });
    }

    if (type === 'chat') {
      const systemInstruction = `You are a travel assistant built into the Wayfarer trip-planning app. You only answer questions related to travel — destinations, packing, itineraries, transport, accommodation, local customs, food, safety, visas, currency, and similar topics. If the user asks about anything unrelated to travel, politely decline and redirect them to their trip.

The user is planning "${trip.name}" — a trip to ${trip.destination} from ${startDate} to ${endDate} (${durationDays} days).

Important: your knowledge has a training cutoff and you do not have access to live data. Always remind users to verify current prices, opening hours, visa requirements, and availability directly with official sources before relying on any specific figures you provide. Give concise, practical advice. Use short paragraphs or bullet points. Avoid generic filler.`;

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction,
      });

      const allMessages = messages ?? [];
      const history = allMessages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const lastMessage = allMessages[allMessages.length - 1]?.content ?? '';

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);
      const reply = result.response.text();

      return res.status(200).json({ reply });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err) {
    console.error('[ai-advisor]', err?.message ?? err);
    return res.status(500).json({ error: 'AI request failed. Check server logs.' });
  }
};
