import { SYSTEM_PROMPT, DEFAULT_MODEL, GOLD_RATE_ANCHOR } from './config.js';

export class APIError extends Error {
  constructor(message, status, type = 'API_ERROR') {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.type = type;
  }
}

// Cache live gold rate for a few minutes so we don't hit the endpoints on every message
let _goldCache = { data: null, ts: 0 };
const GOLD_CACHE_MS = 5 * 60 * 1000;

/**
 * Fetches a live gold price estimate for Pakistan (PKR per tola) using
 * public, key-free endpoints: goldprice.org (USD/oz spot) + open.er-api.com (USD/PKR).
 * Returns null on any failure so the caller can gracefully degrade.
 */
async function fetchLiveGoldRatePKR() {
  const now = Date.now();
  if (_goldCache.data && (now - _goldCache.ts) < GOLD_CACHE_MS) {
    return _goldCache.data;
  }

  try {
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://data-asg.goldprice.org/dbXRates/USD'),
      fetch('https://open.er-api.com/v6/latest/USD')
    ]);

    if (!goldRes.ok || !fxRes.ok) return null;

    const goldJson = await goldRes.json();
    const fxJson = await fxRes.json();

    const usdPerOz = goldJson?.items?.[0]?.xauPrice;
    const usdToPkr = fxJson?.rates?.PKR;

    if (!usdPerOz || !usdToPkr) return null;

    const OZ_TO_GRAM = 31.1035;
    const TOLA_TO_GRAM = 11.6638;
    const pricePerGramUSD = usdPerOz / OZ_TO_GRAM;
    const pricePerTolaPKR = pricePerGramUSD * TOLA_TO_GRAM * usdToPkr;

    const result = {
      tola24k: Math.round(pricePerTolaPKR),
      gram24k: Math.round(pricePerTolaPKR / TOLA_TO_GRAM),
      usdPerOz,
      usdToPkr,
      fetchedAt: new Date().toISOString()
    };

    _goldCache = { data: result, ts: now };
    return result;
  } catch (err) {
    console.warn('Live gold rate fetch failed:', err);
    return null;
  }
}

/**
 * Builds the system message. If the user's latest message looks gold-related,
 * fetches a live rate and injects it as ground truth so the model doesn't
 * guess from stale training data.
 */
async function buildSystemMessage(messages) {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const mentionsGold = /\bgold\b|\bsona\b|\btola\b|\bsarafa\b/i.test(lastUserMsg);

  if (!mentionsGold) {
    return { role: 'system', content: SYSTEM_PROMPT };
  }

  const live = await fetchLiveGoldRatePKR();
  if (!live) {
    const days = Math.max(0, Math.round((Date.now() - new Date(GOLD_RATE_ANCHOR.asOf).getTime()) / 86400000));
    return {
      role: 'system',
      content: SYSTEM_PROMPT + `\n\nLIVE DATA UNAVAILABLE (fetch blocked) — use this verified anchor instead of any other number you might recall: as of ${GOLD_RATE_ANCHOR.asOf}, 24K gold was approximately PKR ${GOLD_RATE_ANCHOR.tola24k.toLocaleString()} per tola. That was ${days} din pehle, aur gold rate roz thoda change hota hai (usually within a few thousand PKR), isliye "approximately PKR ${GOLD_RATE_ANCHOR.tola24k.toLocaleString()}, thoda kam/zyada ho sakta hai — exact rate ke liye aaj ka Sarafa Bazar rate check karo" jaisa bolo. NEVER quote a number far below this (like 200,000) — that is outdated/wrong.`
    };
  }

  return {
    role: 'system',
    content: SYSTEM_PROMPT + `\n\nLIVE DATA (use this, do not invent other numbers): Aaj (${live.fetchedAt}) ka approximate 24K gold rate: PKR ${live.tola24k.toLocaleString()} per tola, PKR ${live.gram24k.toLocaleString()} per gram. Ye international spot price (USD ${live.usdPerOz}/oz) aur USD/PKR (${live.usdToPkr}) se calculate kiya hai — actual Sarafa Bazar rate mein local premium/margin se thoda farq ho sakta hai, isliye "approximately" bolna aur exact local rate check karne ki advice dena.`
  };
}

/**
 * Handles communication with the Groq API (supports streaming and non-streaming responses).
 * @param {string} apiKey - The Groq API key.
 * @param {Array<{role: string, content: string}>} messages - The message history.
 * @param {object} settings - Model and temperature settings.
 * @param {function} onChunk - Optional callback for streaming chunks: (textChunk) => void
 * @returns {Promise<string>} The full assistant response text.
 */
export async function sendChatRequest(apiKey, messages, settings = {}, onChunk = null) {
  if (!apiKey) {
    throw new APIError('API Key is missing. Please enter a valid Groq API key.', 400, 'MISSING_KEY');
  }

  const model = settings.model || DEFAULT_MODEL;
  const systemMessage = await buildSystemMessage(messages);
  const payload = {
    model: model,
    temperature: settings.temperature !== undefined ? parseFloat(settings.temperature) : 0.7,
    max_tokens: 1000,
    messages: [systemMessage, ...messages],
    stream: !!onChunk
  };

  // Defensive timeout handling (e.g. 20 seconds connection threshold)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errData = {};
      try {
        errData = await res.json();
      } catch (e) {
        // Non-JSON format
      }

      const errMsg = errData.error?.message || `HTTP error ${res.status}`;
      
      if (res.status === 401) {
        throw new APIError('Invalid API Key. Please check your key and try again.', 401, 'INVALID_KEY');
      } else if (res.status === 429) {
        throw new APIError('Rate limit exceeded. Please wait a moment before sending another message.', 429, 'RATE_LIMIT');
      } else if (res.status === 403) {
        throw new APIError('Access Forbidden. Your connection might be blocked by firewall or proxy restrictions.', 403, 'FORBIDDEN');
      } else if (res.status === 503) {
        throw new APIError('Groq API servers are currently overloaded. Please try again shortly.', 503, 'OVERLOADED');
      } else if (res.status === 400) {
        throw new APIError('Bad request parameters. Please verify your selected model settings.', 400, 'BAD_REQUEST');
      } else {
        throw new APIError(errMsg, res.status, 'API_FAIL');
      }
    }

    // Standard Non-Streaming response
    if (!onChunk) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) {
        throw new APIError('Unexpected empty response from the API.', 500, 'EMPTY_RESPONSE');
      }
      return reply;
    }

    // Streaming Response using ReadableStream Reader
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save the last incomplete line back to buffer
      buffer = lines.pop();

      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned) continue;
        if (cleaned === 'data: [DONE]') continue;

        if (cleaned.startsWith('data: ')) {
          try {
            const rawJson = cleaned.slice(6);
            const parsed = JSON.parse(rawJson);
            const chunkText = parsed.choices?.[0]?.delta?.content || '';
            if (chunkText) {
              fullText += chunkText;
              onChunk(chunkText);
            }
          } catch (err) {
            console.warn('Could not parse SSE JSON line:', cleaned, err);
          }
        }
      }
    }

    // Handle remaining buffer content
    if (buffer && buffer.startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
      try {
        const rawJson = buffer.trim().slice(6);
        const parsed = JSON.parse(rawJson);
        const chunkText = parsed.choices?.[0]?.delta?.content || '';
        if (chunkText) {
          fullText += chunkText;
          onChunk(chunkText);
        }
      } catch (err) {
        // Silent catch
      }
    }

    if (!fullText) {
      throw new APIError('Unexpected empty streamed response.', 500, 'EMPTY_STREAM');
    }

    return fullText;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new APIError('Request timed out due to unstable network connectivity. Please try again.', 408, 'TIMEOUT');
    }
    if (err instanceof APIError) {
      throw err;
    }
    throw new APIError('Connection error! Please check your internet connection.', 0, 'NETWORK_ERROR');
  }
}
