import { SYSTEM_PROMPT, DEFAULT_MODEL } from './config.js';

export class APIError extends Error {
  constructor(message, status, type = 'API_ERROR') {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.type = type;
  }
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
  const systemMessage = { role: 'system', content: SYSTEM_PROMPT };
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
