// api/claude.js
// Vercel Serverless Function — runs on the server, keeps your API key hidden
// Vercel automatically detects any file in the /api folder as a serverless function

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // Set this in Vercel Dashboard → Settings → Environment Variables
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.body.model || 'claude-sonnet-4-6',
        max_tokens: req.body.max_tokens || 1000,
        system: req.body.system || '',
        messages: req.body.messages || [],
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Claude proxy error:', error);
    return res.status(500).json({ error: 'Proxy failed', message: error.message });
  }
}
