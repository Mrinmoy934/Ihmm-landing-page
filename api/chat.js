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

const CANDIDATE_CONFIGS = [
  { version: 'v1beta', model: 'gemini-2.0-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash' },
  { version: 'v1',     model: 'gemini-1.5-flash' },
  { version: 'v1beta', model: 'gemini-1.5-flash-8b' },
  { version: 'v1beta', model: 'gemini-1.5-pro' }
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;

  // Vercel may pass body as string in static deployments — parse if needed
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { history } = body || {};
  if (!history || !Array.isArray(history)) {
    return res.status(400).json({ error: 'Invalid body. Expected { history: [] }' });
  }

  const rawKey = process.env.GEMINI_API_KEY;
  if (!rawKey) {
    console.error('GEMINI_API_KEY not set in Vercel environment variables');
    return res.status(500).json({
      error: 'GEMINI_API_KEY is missing in Vercel environment variables. Please add it under Vercel Project Settings -> Environment Variables and redeploy.'
    });
  }

  // Strip quotes and whitespace if accidentally pasted with quotes
  const apiKey = rawKey.trim().replace(/^["']+|["']+$/g, '');

  let errors = [];

  for (const cfg of CANDIDATE_CONFIGS) {
    try {
      const url = `https://generativelanguage.googleapis.com/${cfg.version}/models/${cfg.model}:generateContent?key=${apiKey}`;
      const payload = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history,
        generationConfig: { maxOutputTokens: 350, temperature: 0.7 }
      };

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error(`Gemini error (${cfg.version}/${cfg.model}) [${geminiRes.status}]:`, errText);
        let parsedErr = errText;
        try { parsedErr = JSON.parse(errText); } catch (_) {}
        errors.push({ config: cfg, status: geminiRes.status, response: parsedErr });
        continue;
      }

      const data = await geminiRes.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        errors.push({ config: cfg, status: 502, response: 'Empty candidate text in response', data });
        continue;
      }

      return res.status(200).json({ reply });

    } catch (err) {
      console.error(`Fetch exception (${cfg.version}/${cfg.model}):`, err.message);
      errors.push({ config: cfg, status: 500, message: err.message });
    }
  }

  return res.status(502).json({
    error: 'Gemini API request failed on all candidate endpoints',
    details: errors
  });
};
