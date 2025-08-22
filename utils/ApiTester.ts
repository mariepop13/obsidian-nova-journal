import { Notice, requestUrl } from 'obsidian';
import { OPENAI_API_KEY_REGEX, sanitizeForLogging } from './Sanitizer';
import { API_CONFIG } from '../services/shared/Constants';
import { ToastSpinnerService } from '../services/editor/ToastSpinnerService';

export class ApiTester {
  private static readonly TIMEOUT_MS = API_CONFIG.TIMEOUT_MS;
  private static readonly OPENAI_API_KEY_REGEX = OPENAI_API_KEY_REGEX;

  static async testOpenAIConnection(apiKey: string): Promise<void> {
    try {
      const { validateApiKey } = await import('./Sanitizer');
      const validatedKey = validateApiKey(apiKey);
      
      await this.performApiTest(validatedKey);
    } catch (error) {
      ToastSpinnerService.error(error instanceof Error ? error.message : 'Invalid API key');
    }
  }

  private static async performApiTest(apiKey: string): Promise<void> {
    try {
      const response = await Promise.race([
        requestUrl({
          url: API_CONFIG.OPENAI_MODELS_URL,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': API_CONFIG.USER_AGENT,
          },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), this.TIMEOUT_MS)),
      ]) as any;

      const data = (typeof response.json !== 'undefined')
        ? response.json
        : JSON.parse(response.text || '{}');

      if (response.status >= 200 && response.status < 300) {
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
