/**
 * MaalBot — Groq API Proxy (Cloudflare Worker)
 * ----------------------------------------------
 * Purpose: keep your Groq API key OUT of the browser. Right now MaalBot's
 * frontend stores the key in localStorage, which anyone can read via
 * DevTools. This worker sits in between: the frontend calls YOUR worker
 * (no key needed client-side), and the worker attaches the real key
 * server-side before forwarding to Groq.
 *
 * SETUP (5 minutes, free):
 * 1. Sign up at https://dash.cloudflare.com (free tier is enough)
 * 2. Install Wrangler:  npm install -g wrangler
 * 3. wrangler login
 * 4. In this folder run:  wrangler secret put GROQ_API_KEY
 *    (paste your gsk_... key when prompted — it is stored encrypted,
 *    never visible in code or logs)
 * 5. wrangler deploy
 * 6. You'll get a URL like https://maalbot-proxy.<you>.workers.dev
 *    Point src/js/config.js's API endpoint at that URL instead of
 *    https://api.groq.com/openai/v1/chat/completions, and remove the
 *    apiKey/Authorization header logic from src/js/api.js (the worker
 *    adds it for you now).
 *
 * This also lets you add per-user rate limiting later (see commented
 * section below) so one person can't burn your whole Groq quota.
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST is supported', { status: 405, headers: corsHeaders() });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // --- Optional: simple per-IP rate limit using Workers KV (uncomment + bind a KV namespace) ---
    // const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    // const key = `rate:${ip}`;
    // const count = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0');
    // if (count > 30) return json({ error: 'Rate limit exceeded, try again later.' }, 429);
    // await env.RATE_LIMIT_KV.put(key, String(count + 1), { expirationTtl: 3600 });

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    // Stream the response straight through (works for both streaming and non-streaming)
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...corsHeaders(), 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' }
    });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // tighten to your github.io domain in production
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
}
