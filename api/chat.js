// api/chat.js — Vercel Serverless Function (CommonJS)
// Proxies requests to Gemini API. GEMINI_API_KEY stored in Vercel Environment Variables.

const SYSTEM_PROMPT = `You are the EnviGuide IHM virtual assistant — a professional AI agent for EnviGuide IHM, a maritime SaaS platform for Inventory of Hazardous Materials (IHM Part I) compliance.

Guidelines:
- Answer questions about IHM Part I, MARPOL regulations, Hong Kong Convention, and EU Ship Recycling Regulation
- Explain features: automated supplier outreach, MD/SDoC collection, fleet dashboard, audit-ready class reports
- For pricing, say it is fleet-size dependent and direct to the demo booking page (book-demo.html)
- For complex or sales queries, suggest booking a demo, emailing info@enviguide.com, or contacting on WhatsApp at +91 9986331158
- Keep replies concise: 2-4 sentences max. Be friendly, professional, and clear
- Do NOT reveal you are powered by Google Gemini or any third-party AI model`;

const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
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
      error: 'GEMINI_API_KEY missing in Vercel environment variables. Please add it in Vercel Settings.'
    });
  }

  const apiKey = rawKey.trim().replace(/^["']+|["']+$/g, '');

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
        console.error(`Gemini error with model ${model} (${geminiRes.status}):`, errText);
        lastError = { model, status: geminiRes.status, details: errText };
        continue;
      }

      const data = await geminiRes.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        console.error(`Empty response from model ${model}:`, JSON.stringify(data));
        lastError = { model, status: 502, details: 'Empty content in candidate' };
        continue;
      }

      return res.status(200).json({ reply });

    } catch (err) {
      console.error(`Exception with model ${model}:`, err.message);
      lastError = { model, status: 500, details: err.message };
    }
  }

  return res.status(502).json({
    error: 'All Gemini model endpoints failed',
    lastError
  });
};
