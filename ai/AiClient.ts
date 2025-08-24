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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionPayload {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
}

export interface OpenAIChoice {
  message: {
    content?: string | Array<{ text?: string }>;
    output_text?: string;
  } | undefined;
}

export interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

interface GenericResponse {
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

interface ObsidianRequestResponse {
  status: number;
  text?: string;
  json?: unknown;
}

import { sanitizeForLogging } from '../utils/Sanitizer';
import { AI_LIMITS, API_CONFIG, REGEX_PATTERNS } from '../services/shared/Constants';
import { logger } from '../services/shared/LoggingService';
import { requestUrl } from 'obsidian';

const HTTP_STATUS = {
  OK_MIN: 200,
  OK_MAX: 300,
} as const;

async function callOnce(config: APICallConfig): Promise<string> {
  const payload = buildPayload(config);
  const response = await makeAPICall(config.apiKey, payload);

  if (!response.ok) {
    await handleAPIError(response, config.debug);
  }

  const data = await response.json();
  return parseResponse(data);
}

function buildPayload(config: APICallConfig): ChatCompletionPayload {
  const safeMax =
    Number.isFinite(config.maxTokens) && config.maxTokens > 0
      ? Math.min(Math.floor(config.maxTokens), AI_LIMITS.MAX_TOKENS_HARD_LIMIT)
      : AI_LIMITS.DEFAULT_TOKENS;

  const payload: ChatCompletionPayload = {
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

interface ResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<OpenAIResponse | Record<string, unknown>>;
  text: () => Promise<string>;
}

async function parseResponseJson(res: unknown): Promise<OpenAIResponse | Record<string, unknown>> {
  const genericRes = res as unknown as GenericResponse;
  
  if (typeof genericRes.json === 'function') {
    const result = await genericRes.json();
    return (result ?? {}) as OpenAIResponse | Record<string, unknown>;
  }
  
  if (typeof genericRes.text === 'function') {
    return JSON.parse(await genericRes.text()) as Record<string, unknown>;
  }
  
  // Obsidian provides a parsed json field in many cases
  const obsidianRes = res as ObsidianRequestResponse;
  if (typeof obsidianRes.json !== 'undefined' && obsidianRes.json !== null) {
    return obsidianRes.json as OpenAIResponse | Record<string, unknown>;
  }
  
  return JSON.parse((res as { text?: string }).text ?? '{}') as Record<string, unknown>;
}

function createJsonMethod(res: unknown): () => Promise<OpenAIResponse | Record<string, unknown>> {
  return async (): Promise<OpenAIResponse | Record<string, unknown>> => {
    try {
      return await parseResponseJson(res);
    } catch {
      return {};
    }
  };
}

function createTextMethod(res: unknown): () => Promise<string> {
  return async (): Promise<string> => {
    try {
      const genericRes = res as unknown as GenericResponse;
      if (typeof genericRes.text === 'function') return await genericRes.text();
      return String((res as unknown as { text?: string }).text ?? '');
    } catch {
      return '';
    }
  };
}

function createRequestHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': API_CONFIG.USER_AGENT,
  };
}

function createResponseLike(res: ObsidianRequestResponse): ResponseLike {
  return {
    ok: (typeof res.status === 'number') && res.status >= HTTP_STATUS.OK_MIN && res.status < HTTP_STATUS.OK_MAX,
    status: typeof res.status === 'number' ? res.status : 0,
    statusText: String(res.status ?? ''),
    json: createJsonMethod(res),
    text: createTextMethod(res),
  };
}

async function makeAPICall(apiKey: string, payload: ChatCompletionPayload): Promise<ResponseLike> {
  try {
    const res = await requestUrl({
      url: API_CONFIG.OPENAI_CHAT_URL,
      method: 'POST',
      headers: createRequestHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    return createResponseLike(res);
  } catch (err) {
    throw new Error(`Network request failed: ${String(err)}`);
  }
}

async function handleAPIError(response: ResponseLike, debug: boolean): Promise<never> {
  const errText = await response.text().catch(() => '');
  
  if (debug) {
    logger.debug(`AI API error: ${response.status} ${response.statusText}`, 'AiClient');
    logger.debug(`Error details: ${sanitizeForLogging(errText)}`, 'AiClient');
  } else {
    logger.error(`AI request failed: ${response.status}`, 'AiClient');
  }

  throw new Error(`AI request failed (${response.status}): ${response.statusText}`);
}

function parseResponse(data: OpenAIResponse): string {
  const choice = data?.choices?.[0];
  const msg = choice?.message;

  if (!msg) {
    throw new Error('AI response missing message');
  }

  const text = extractTextFromMessage(msg);
  
  if (!text) {
    throw new Error('AI response missing content');
  }

  return text;
}

function extractTextFromMessage(msg: { content?: string | Array<{ text?: string }>; output_text?: string }): string {
  if (typeof msg.content === 'string') {
    return msg.content.trim();
  }
  
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((p: { text?: string }) => p?.text ?? '')
      .join('')
      .trim();
  }
  
  if (typeof (msg as { output_text?: string })?.output_text === 'string') {
    return (msg as { output_text: string }).output_text.trim();
  }

  return '';
}

class RateLimiter {
  private static requests: Map<string, number[]> = new Map();
  private static readonly WINDOW_MS = AI_LIMITS.RATE_LIMIT_WINDOW_MS;
  private static readonly MAX_REQUESTS = AI_LIMITS.RATE_LIMIT_MAX_REQUESTS;

  static checkRateLimit(apiKey: string): boolean {
    const normalizedKey = apiKey.trim();
    const keyHash = normalizedKey.substring(0, AI_LIMITS.RATE_LIMIT_KEY_HASH_LENGTH);
    const now = Date.now();
    const requests = this.requests.get(keyHash) ?? [];

    const recentRequests = requests.filter(time => now - time < this.WINDOW_MS);

    if (recentRequests.length >= this.MAX_REQUESTS) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(keyHash, recentRequests);
    return true;
  }
}

function validateChatRequest(apiKey: string): void {
  validateApiKey(apiKey);
  
  if (!RateLimiter.checkRateLimit(apiKey)) {
    throw new Error('Rate limit exceeded. Please wait before making more requests');
  }
}

export async function chat(args: ChatArgs): Promise<string> {
  validateChatRequest(args.apiKey);

  const config = await createChatConfig({
    apiKey: args.apiKey,
    model: args.model ?? 'gpt-5-mini',
    systemPrompt: args.systemPrompt,
    userText: args.userText,
    maxTokens: args.maxTokens ?? AI_LIMITS.DEFAULT_TOKENS,
    debug: args.debug ?? false,
  });

  return await executeChatWithRetry(config, args.retryCount ?? 0, args.fallbackModel ?? '');
}

function validateApiKey(apiKey: string): void {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Valid API key required');
  }
}

async function createChatConfig(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  maxTokens: number;
  debug: boolean;
}): Promise<APICallConfig> {
  const { sanitizeUserInput } = await import('../utils/Sanitizer');
  
  return {
    apiKey: params.apiKey,
    modelName: params.model,
    systemPrompt: sanitizeUserInput(params.systemPrompt, AI_LIMITS.USER_INPUT_MAX_LENGTH),
    userText: sanitizeUserInput(params.userText, AI_LIMITS.USER_INPUT_MAX_LENGTH),
    maxTokens: params.maxTokens,
    debug: params.debug,
  };
}

async function applyBackoffDelayIfNeeded(attempt: number, maxTries: number): Promise<void> {
  if (attempt < maxTries) {
    const base = Math.max(1, AI_LIMITS.BACKOFF_BASE_MS);
    const exponent = Math.max(0, Number(attempt));
    const raw = base * Math.pow(2, exponent);
    const backoff = Math.min(raw, AI_LIMITS.BACKOFF_MAX_DELAY_MS);
    await new Promise((r) => setTimeout(r, backoff));
  }
}

async function executeChatWithRetry(
  config: APICallConfig,
  retryCount: number,
  fallbackModel: string
): Promise<string> {
  const tries = Math.max(0, Math.min(AI_LIMITS.MAX_RETRIES, retryCount));
  
  const primaryResult = await tryWithPrimaryModel(config, tries);
  if (typeof primaryResult === 'string') {
    return primaryResult;
  }

  const fallbackResult = await tryWithFallbackModel(config, fallbackModel);
  if (fallbackResult.success) {
    return fallbackResult.result;
  }

  throw fallbackResult.error ?? primaryResult ?? new Error('AI request failed');
}

async function tryWithPrimaryModel(config: APICallConfig, tries: number): Promise<string | Error> {
  let lastError: Error | null = null;

  for (let i = 0; i <= tries; i += 1) {
    try {
      return await callOnce(config);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      await applyBackoffDelayIfNeeded(i, tries);
    }
  }

  return lastError ?? new Error('Primary model failed');
}

async function tryWithFallbackModel(
  config: APICallConfig, 
  fallbackModel: string
): Promise<{ success: true; result: string } | { success: false; error: Error | null }> {
  if (!fallbackModel || fallbackModel === config.modelName) {
    return { success: false, error: null };
  }

  try {
    const fallbackConfig = { ...config, modelName: fallbackModel };
    const result = await callOnce(fallbackConfig);
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
