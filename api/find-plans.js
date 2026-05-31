const Groq = require('groq-sdk');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const { destination, date, dayNumber, totalDays } = req.body ?? {};
  if (!destination) return res.status(400).json({ error: 'Missing destination' });

  const groq = new Groq({ apiKey });

  const dateStr = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'unknown date';

  const prompt = `Suggest 7 varied activities, restaurants, and things to do in ${destination} for Day ${dayNumber} of ${totalDays} (${dateStr}).

Mix the types: include sightseeing, a meal, maybe a neighbourhood walk, a cultural experience, and something unique to the area.

Return ONLY a valid JSON array — no markdown, no explanation. Each object must have:
- "title": short name of the activity/place
- "category": one of "activity" | "food" | "transport" | "accommodation" | "other"
- "time": suggested start time like "09:00" or null
- "description": 1–2 sentence practical description with any tips
- "location": specific address or area name (or null)
- "estimatedCost": e.g. "Free", "~€15", "$30–50" (or null)`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: 'You are a local travel expert. Return only valid JSON arrays with no markdown or extra text.',
        },
        { role: 'user', content: prompt },
      ],
    });

    let text = response.choices[0].message.content.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let suggestions = [];
    try {
      suggestions = JSON.parse(text);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch (_) {
      suggestions = [];
    }

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('[find-plans]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to fetch suggestions.' });
  }
};
