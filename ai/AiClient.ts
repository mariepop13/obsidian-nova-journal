export interface ChatArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  maxTokens?: number;
  debug?: boolean;
  retryCount?: number;
  fallbackModel?: string;
}

function sanitizeErrorForLogging(error: string): string {
  return error
    .replace(/Bearer\s+sk-[A-Za-z0-9-_]+/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key['":\s]*[A-Za-z0-9-_]+/gi, 'api_key: [REDACTED]')
    .replace(/sk-[A-Za-z0-9-_]{20,}/gi, '[API_KEY_REDACTED]');
}

async function callOnce(apiKey: string, modelName: string, systemPrompt: string, userText: string, maxTokens: number, debug: boolean): Promise<string> {
  const safeMax = Number.isFinite(maxTokens) && maxTokens > 0 ? Math.min(Math.floor(maxTokens), 8192) : 512;
  const payload: any = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
  };
  if (/^gpt-5/i.test(modelName)) payload.max_completion_tokens = safeMax; else payload.max_tokens = safeMax;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    if (debug) console.error('Nova AI status', resp.status, resp.statusText);
    const errText = await resp.text().catch(() => '');
    if (debug) {
      const sanitizedError = sanitizeErrorForLogging(errText);
      console.error('Nova AI error body', sanitizedError);
    }
    throw new Error(`AI request failed (${resp.status}): ${resp.statusText}`);
  }
  const data = await resp.json();
  // Success logs remain in console only when dev tools open
  const choice = data?.choices?.[0];
  const msg = choice?.message;
  let text = '';
  if (typeof msg?.content === 'string') text = msg.content.trim();
  else if (Array.isArray(msg?.content)) text = msg.content.map((p: any) => (p?.text ?? '')).join('').trim();
  else if (typeof (msg as any)?.output_text === 'string') text = (msg as any).output_text.trim();
  if (!text) {
    throw new Error('AI response missing content');
  }
  return text;
}

export async function chat({ apiKey, model, systemPrompt, userText, maxTokens = 512, debug = false, retryCount = 0, fallbackModel = '' }: ChatArgs): Promise<string> {
  const primary = model || 'gpt-5-mini';
  const tries = Math.max(0, Math.min(5, retryCount));
  let lastError: any = null;
  for (let i = 0; i <= tries; i += 1) {
    try {
      return await callOnce(apiKey, primary, systemPrompt, userText, maxTokens, debug);
    } catch (e) {
      lastError = e;
      if (i < tries) {
        const backoff = 250 * Math.pow(2, i);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  if (fallbackModel && fallbackModel !== primary) {
    try {
      return await callOnce(apiKey, fallbackModel, systemPrompt, userText, maxTokens, debug);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('AI request failed');
}

