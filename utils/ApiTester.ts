import { Notice } from 'obsidian';
import { OPENAI_API_KEY_REGEX, sanitizeForLogging } from './Sanitizer';
import { API_CONFIG } from '../services/shared/Constants';

export class ApiTester {
  private static readonly TIMEOUT_MS = API_CONFIG.TIMEOUT_MS;
  private static readonly OPENAI_API_KEY_REGEX = OPENAI_API_KEY_REGEX;

  static async testOpenAIConnection(apiKey: string): Promise<void> {
    const trimmedKey = apiKey?.trim();

    if (!trimmedKey) {
      new Notice('Set your OpenAI API key first.');
      return;
    }

    if (!this.OPENAI_API_KEY_REGEX.test(trimmedKey)) {
      new Notice('API key format appears invalid. OpenAI keys start with "sk-".');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(API_CONFIG.OPENAI_MODELS_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'User-Agent': API_CONFIG.USER_AGENT
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;
        const message = `OpenAI test: OK${modelCount ? ` (${modelCount} models accessible)` : ''}`;
        new Notice(message);
      } else {
        const errorMessage = sanitizeForLogging(
          data?.error?.message || `HTTP ${response.status}`
        );
        new Notice(`OpenAI test failed: ${errorMessage}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as any).name === 'AbortError') {
        new Notice('OpenAI test timed out. Check your connection.');
      } else {
        const errorMessage = sanitizeForLogging(
          (error as any)?.message || 'Unknown error'
        );
        new Notice(`OpenAI test error: ${errorMessage}`);
      }
    }
  }
}