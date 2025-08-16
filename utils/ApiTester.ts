import { OPENAI_API_KEY_REGEX, sanitizeForLogging } from './Sanitizer';
import { API_CONFIG } from '../services/shared/Constants';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';

export class ApiTester {
  private static readonly TIMEOUT_MS = API_CONFIG.TIMEOUT_MS;
  private static readonly OPENAI_API_KEY_REGEX = OPENAI_API_KEY_REGEX;

  static async testOpenAIConnection(apiKey: string): Promise<void> {
    const trimmedKey = apiKey?.trim();

    if (!trimmedKey) {
      ToastSpinnerService.error('Set your OpenAI API key first.');
      return;
    }

    if (!this.OPENAI_API_KEY_REGEX.test(trimmedKey)) {
      ToastSpinnerService.error('API key format appears invalid. OpenAI keys start with "sk-".');
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
        ToastSpinnerService.notice(message);
      } else {
        const errorMessage = sanitizeForLogging(
          data?.error?.message || `HTTP ${response.status}`
        );
        ToastSpinnerService.error(`OpenAI test failed: ${errorMessage}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        ToastSpinnerService.error('OpenAI test timed out. Check your connection.');
      } else {
        const errorMessage = sanitizeForLogging(
          error instanceof Error ? error.message : 'Unknown error'
        );
        ToastSpinnerService.error(`OpenAI test error: ${errorMessage}`);
      }
    }
  }
}