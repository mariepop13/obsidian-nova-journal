export const MOOD_LIMITS = {
  DOMINANT_EMOTIONS: 5,
  TAGS: 8,
  PEOPLE_PRESENT: 10,
} as const;

export const AI_LIMITS = {
  MAX_TOKENS_HARD_LIMIT: 8192,
  DEFAULT_TOKENS: 512,
  MAX_RETRIES: 5,
  BACKOFF_BASE_MS: 250,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 50,
  RATE_LIMIT_KEY_HASH_LENGTH: 8,
  USER_INPUT_MAX_LENGTH: 5000,
  USER_TEXT_MAX_LENGTH: 50000,
} as const;

export const TYPEWRITER_DELAYS = {
  SLOW: 90,
  NORMAL: 50,
  FAST: 25,
  MAX_DURATION_MS: 4000,
  PAUSE_MULTIPLIERS: {
    COMMA: 3, // virgules, points-virgules, deux-points (150ms pour normal)
    SENTENCE: 6, // points, points d'exclamation, points d'interrogation (300ms)
    NEWLINE: 10, // nouvelles lignes (500ms)
  },
} as const;

export const REGEX_PATTERNS = {
  GPT5_MODEL: /^gpt-5/i,
  DATE_HEADING: /^#{1,6}\s*\d{4}-\d{2}-\d{2}\s*$/,
  HEADING: /^\s*#{1,6}\s*.+$/,
  SPEAKER_LINE: /^[^\s].*:\s*$/,
  FRONTMATTER_DELIMITER: /^---$/,
} as const;

export const CSS_CLASSES = {
  NOVA_DEEPEN: 'nova-deepen',
  NOVA_MOOD_ANALYZE: 'nova-mood-analyze',
} as const;

export const API_CONFIG = {
  OPENAI_CHAT_URL: 'https://api.openai.com/v1/chat/completions',
  OPENAI_MODELS_URL: 'https://api.openai.com/v1/models',
  TIMEOUT_MS: 10000,
  USER_AGENT: 'Nova-Journal-Plugin/1.0',
} as const;

export const TEMPLATE_PATTERNS = {
  PROMPT: /\{\{\s*prompt\s*\}\}/g,
  USER_LINE: /\{\{\s*user_line\s*\}\}/g,
  DATE: /\{\{\s*date(?::([^}]+))?\s*\}\}/g,
  MULTIPLE_NEWLINES: /\n{3,}/g,
} as const;

export const EXCLUDED_NAMES = new Set(['nova', 'ai', 'assistant', 'you', 'me']);
export const VALID_SENTIMENTS = ['positive', 'neutral', 'negative'] as const;
export const FRONTMATTER_ORDER = ['mood_emoji', 'sentiment', 'dominant_emotions', 'tags', 'people_present'] as const;
