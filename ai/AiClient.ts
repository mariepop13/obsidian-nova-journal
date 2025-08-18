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

export interface APICallConfig {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  userText: string;
  maxTokens: number;
  debug: boolean;
}

import { sanitizeForLogging } from '../utils/Sanitizer';
import { AI_LIMITS, API_CONFIG, REGEX_PATTERNS } from '../services/shared/Constants';

async function callOnce(config: APICallConfig): Promise<string> {
  const payload = buildPayload(config);
  const response = await makeAPICall(config.apiKey, payload);
  
  if (!response.ok) {
    await handleAPIError(response, config.debug);
  }
  
  const data = await response.json();
  return parseResponse(data);
}

function buildPayload(config: APICallConfig): Record<string, any> {
  const safeMax = Number.isFinite(config.maxTokens) && config.maxTokens > 0 
    ? Math.min(Math.floor(config.maxTokens), AI_LIMITS.MAX_TOKENS_HARD_LIMIT) 
    : AI_LIMITS.DEFAULT_TOKENS;
    
  const payload: any = {
    model: config.modelName,
    messages: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: config.userText },
    ],
  };
  
  if (REGEX_PATTERNS.GPT5_MODEL.test(config.modelName)) {
    payload.max_completion_tokens = safeMax;
  } else {
    payload.max_tokens = safeMax;
  }
  
  return payload;
}

async function makeAPICall(apiKey: string, payload: Record<string, any>): Promise<Response> {
  return fetch(API_CONFIG.OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

async function handleAPIError(response: Response, debug: boolean): Promise<never> {
  if (debug) console.error('Nova AI status', response.status, response.statusText);
  
  const errText = await response.text().catch(() => '');
  if (debug) console.error('Nova AI error body', sanitizeForLogging(errText));
  
  throw new Error(`AI request failed (${response.status}): ${response.statusText}`);
}

function parseResponse(data: any): string {
  const choice = data?.choices?.[0];
  const msg = choice?.message;
  let text = '';
  
  if (typeof msg?.content === 'string') {
    text = msg.content.trim();
  } else if (Array.isArray(msg?.content)) {
    text = msg.content.map((p: { text?: string }) => (p?.text ?? '')).join('').trim();
  } else if (typeof (msg as { output_text?: string })?.output_text === 'string') {
    text = (msg as { output_text: string }).output_text.trim();
  }
  
  if (!text) {
    throw new Error('AI response missing content');
  }
  
  return text;
}

class RateLimiter {
  private static requests: Map<string, number[]> = new Map();
  private static readonly WINDOW_MS = 60000; // 1 minute
  private static readonly MAX_REQUESTS = 50; // per minute per API key

  static checkRateLimit(apiKey: string): boolean {
    const keyHash = apiKey.substring(0, 8);
    const now = Date.now();
    const requests = this.requests.get(keyHash) || [];
    
    const recentRequests = requests.filter(time => now - time < this.WINDOW_MS);
    
    if (recentRequests.length >= this.MAX_REQUESTS) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(keyHash, recentRequests);
    return true;
  }
}

export async function chat({ apiKey, model, systemPrompt, userText, maxTokens = AI_LIMITS.DEFAULT_TOKENS, debug = false, retryCount = 0, fallbackModel = '' }: ChatArgs): Promise<string> {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Valid API key required');
  }
  
  if (!RateLimiter.checkRateLimit(apiKey)) {
    throw new Error('Rate limit exceeded. Please wait before making more requests');
  }
  
  const { sanitizeUserInput } = await import('../utils/Sanitizer');
  
  const primary = model || 'gpt-5-mini';
  const tries = Math.max(0, Math.min(AI_LIMITS.MAX_RETRIES, retryCount));
  
  const config: APICallConfig = {
    apiKey,
    modelName: primary,
    systemPrompt: sanitizeUserInput(systemPrompt, 5000),
    userText: sanitizeUserInput(userText, 50000),
    maxTokens,
    debug
  };
  
  let lastError: any = null;
  
  for (let i = 0; i <= tries; i += 1) {
    try {
      return await callOnce(config);
    } catch (e) {
      lastError = e;
      if (i < tries) {
        const backoff = AI_LIMITS.BACKOFF_BASE_MS * Math.pow(2, i);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
  }
  
  if (fallbackModel && fallbackModel !== primary) {
    try {
      const fallbackConfig = { ...config, modelName: fallbackModel };
      return await callOnce(fallbackConfig);
    } catch (e) {
      lastError = e;
    }
  }
  
  throw lastError || new Error('AI request failed');
}

