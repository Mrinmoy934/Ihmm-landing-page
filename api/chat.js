// api/chat.js — Vercel Serverless Function (CommonJS)
// Proxies requests to Google Gemini API. GEMINI_API_KEY stored in Vercel Environment Variables.

const SYSTEM_PROMPT = `You are the IHMM AI Assistant — an expert maritime compliance AI for IHMM, an intelligent SaaS platform for Inventory of Hazardous Materials (IHM Part I) compliance, EU SRR (1257/2013), and the Hong Kong Convention (HKC).

Your capabilities & core knowledge:
1. IHM Part I Compliance: Guide shipowners, managers, and maritime suppliers on maintaining active IHM Part I throughout ship operations.
2. Automated MD/SDoC Collection: Explain how IHMM automatically reaches out to marine suppliers, validates Material Declarations (MD) and Supplier Declarations of Conformity (SDoC), and parses HazMat thresholds (Asbestos, PCBs, Ozone Depleting Substances, PFOS, Heavy Metals).
3. Class Society & Port State Control (PSC) Readiness: Class approval reports formatted for DNV, Lloyd's Register (LR), ABS, Bureau Veritas (BV), and ClassNK.
4. Pricing & Demos: Direct users to book a demo via the website (book-demo.html) or contact our team on WhatsApp at +91 9986331158 for customized fleet quotes.
5. Response Style:
   - Provide natural, dynamic, conversational, and helpful answers.
   - Vary phrasing and avoid generic repetitive template answers.
   - Keep answers clear and informative (2-4 concise paragraphs or bullet points).
   - Never say you are Gemini or Google AI — you are the IHMM AI Assistant.`;

const CANDIDATE_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-2.5-flash'
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
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

  // Sanitize and validate conversation history for Gemini multi-turn requirements
  const cleanContents = [];
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const role = (item.role === 'model' || item.role === 'assistant') ? 'model' : 'user';
    const text = item.parts?.[0]?.text || (typeof item.content === 'string' ? item.content : '');
    if (!text || typeof text !== 'string' || !text.trim()) continue;

    if (cleanContents.length > 0 && cleanContents[cleanContents.length - 1].role === role) {
      // Merge consecutive messages from same role to satisfy Gemini alternating turns rule
      cleanContents[cleanContents.length - 1].parts[0].text += '\n\n' + text.trim();
    } else {
      cleanContents.push({ role, parts: [{ text: text.trim() }] });
    }
  }

  // Must start with user message
  while (cleanContents.length > 0 && cleanContents[0].role !== 'user') {
    cleanContents.shift();
  }

  if (cleanContents.length === 0) {
    return res.status(400).json({ error: 'No user message in history' });
  }

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: cleanContents,
        generationConfig: {
          maxOutputTokens: 450,
          temperature: 0.85,
          topP: 0.95
        }
      };

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error(`Gemini model ${model} error (${geminiRes.status}):`, errText);
        lastError = { model, status: geminiRes.status, details: errText };
        continue;
      }

      const data = await geminiRes.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!reply) {
        lastError = { model, status: 502, details: 'Empty content in candidate' };
        continue;
      }

      return res.status(200).json({ reply: reply.trim() });

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
