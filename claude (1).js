// api/claude.js — PulseMind V2 Vercel Serverless Proxy
// Keeps ANTHROPIC_API_KEY secure on server side

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not set',
      detail: 'Go to Vercel Dashboard → Your Project → Settings → Environment Variables → Add ANTHROPIC_API_KEY'
    });
  }

  try {
    const { model, max_tokens, system, messages } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 1000,
        system: system || '',
        messages: messages || [],
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (err) {
    console.error('PulseMind proxy error:', err);
    return res.status(500).json({ error: 'Proxy failed', message: err.message });
  }
}
