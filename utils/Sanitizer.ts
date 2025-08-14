export const OPENAI_API_KEY_REGEX = /^sk-[A-Za-z0-9-_]{20,}$/;

export function sanitizeForLogging(input: unknown): string {
  const text = String(input ?? '');
  return text
    .replace(/Bearer\s+sk-[A-Za-z0-9-_]{20,}/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9-_]{20,}/gi, '[API_KEY_REDACTED]')
    .replace(/\bapi[_-]?key\b(["':\s]*)[A-Za-z0-9-_]+/gi, 'api_key$1[REDACTED]');
}


