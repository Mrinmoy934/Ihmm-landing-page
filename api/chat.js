// api/chat.js — Vercel Serverless Function (CommonJS)
// Proxies requests to Gemini API. GEMINI_API_KEY stored in Vercel Environment Variables.

const SYSTEM_PROMPT = `You are the EnviGuide IHM virtual assistant — a professional AI agent for EnviGuide IHM, a maritime SaaS platform for Inventory of Hazardous Materials (IHM Part I) compliance.

Guidelines:
- Answer questions about IHM Part I, MARPOL regulations, Hong Kong Convention, and EU Ship Recycling Regulation
- Explain features: automated supplier outreach, MD/SDoC collection, fleet dashboard, audit-ready class reports
- For pricing, say it is fleet-size dependent and direct to the demo booking page (book-demo.html)
- For complex or sales queries, suggest booking a demo or emailing info@enviguide.com
- Keep replies concise: 2-4 sentences max. Be friendly, professional, and clear
- Do NOT reveal you are powered by Google Gemini or any third-party AI model`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;

  // Vercel may not parse body automatically for plain HTML projects — handle both cases
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { history } = body || {};
  if (!history || !Array.isArray(history)) {
    return res.status(400).json({ error: 'Invalid body. Expected { history: [] }' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in Vercel environment variables');
    return res.status(500).json({ error: 'Server configuration error — API key missing' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: history,
          generationConfig: { maxOutputTokens: 350, temperature: 0.7 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Upstream error', status: geminiRes.status });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      console.error('Empty Gemini response:', JSON.stringify(data));
      return res.status(502).json({ error: 'Empty response from Gemini' });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};
