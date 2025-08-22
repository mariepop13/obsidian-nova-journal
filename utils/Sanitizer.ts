import { AI_LIMITS, VALIDATION_LIMITS } from '../services/shared/Constants';

export const OPENAI_API_KEY_REGEX = /^sk-[A-Za-z0-9-_]{20,}$/;
export function validateApiKey(apiKey: unknown): string {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }

  const trimmed = apiKey.trim();
  if (trimmed.length < VALIDATION_LIMITS.API_KEY_MIN_LENGTH) {
    throw new Error('API key too short');
  }

  if (!OPENAI_API_KEY_REGEX.test(trimmed)) {
    throw new Error('Invalid API key format');
  }

  return trimmed;
}

export function sanitizeForLogging(input: unknown): string {
  if (input === null || input === undefined) return '';

  const text = String(input);
  return text
    .replace(/Bearer\s+sk-[A-Za-z0-9-_]{20,}/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9-_]{20,}/gi, '[API_KEY_REDACTED]')
    .replace(new RegExp(`\\bapi[_-]?key\\b(["':\\s]*)[A-Za-z0-9-_]{${VALIDATION_LIMITS.API_KEY_MIN_PATTERN_LENGTH},}`, 'gi'), 'api_key$1[REDACTED]')
    .replace(new RegExp(`\\b(password|secret|token|key)\\b(["':\\s]*)[A-Za-z0-9-_+/]{${VALIDATION_LIMITS.SECRET_MIN_LENGTH},}`, 'gi'), '$1$2[REDACTED]')
    .replace(new RegExp(`[A-Za-z0-9+/]{${VALIDATION_LIMITS.ENCODED_DATA_MIN_LENGTH},}={0,2}`, 'g'), '[ENCODED_DATA_REDACTED]')
    .replace(new RegExp(`\\b[A-Fa-f0-9]{${VALIDATION_LIMITS.HASH_MIN_LENGTH},}\\b`, 'g'), '[HASH_REDACTED]');
}

export function validateAndParseJSON<T = unknown>(input: string, fallback?: T): T | null {
  if (typeof input !== 'string') return fallback ?? null;

  const trimmed = input.trim();
  if (!trimmed || trimmed.length === 0) return fallback ?? null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback ?? null;
  }
}

export function sanitizeUserInput(input: unknown, maxLength = AI_LIMITS.USER_INPUT_MAX_LENGTH): string {
  if (input === null || input === undefined) return '';

  const text = String(input);
  if (text.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  return text
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .trim();
}

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
