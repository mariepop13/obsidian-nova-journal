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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const response = await fetch(API_CONFIG.OPENAI_MODELS_URL, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': API_CONFIG.USER_AGENT,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));

      this.handleApiResponse(response, data);
    } catch (error) {
      clearTimeout(timeoutId);
      this.handleApiError(error);
    }
  }

  private static handleApiResponse(response: Response, data: unknown): void {
    if (response.ok) {
      const isValidData = data && typeof data === 'object' && 'data' in data;
      const modelCount = isValidData && Array.isArray((data as { data: unknown }).data) 
        ? (data as { data: unknown[] }).data.length 
        : undefined;
      const message = `OpenAI test: OK${modelCount ? ` (${modelCount} models accessible)` : ''}`;
      ToastSpinnerService.notice(message);
    } else {
      const isErrorData = data && typeof data === 'object' && 'error' in data;
      const errorObj = isErrorData ? (data as { error: unknown }).error : null;
      const errorMessage = errorObj && typeof errorObj === 'object' && errorObj !== null && 'message' in errorObj
        ? String((errorObj as { message: unknown }).message)
        : `HTTP ${response.status}`;
      ToastSpinnerService.error(`OpenAI test failed: ${sanitizeForLogging(errorMessage)}`);
    }
  }

  private static handleApiError(error: unknown): void {
    if (error instanceof Error && error.name === 'AbortError') {
      ToastSpinnerService.error('OpenAI test timed out. Check your connection.');
    } else {
      const errorMessage = sanitizeForLogging(error instanceof Error ? error.message : 'Unknown error');
      ToastSpinnerService.error(`OpenAI test error: ${errorMessage}`);
    }
  }
}
