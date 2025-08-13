import { Notice } from 'obsidian';

export class ApiTester {
  private static readonly TIMEOUT_MS = 10000;
  private static readonly OPENAI_API_KEY_REGEX = /^sk-[A-Za-z0-9-_]{20,}$/;

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
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'User-Agent': 'Nova-Journal-Plugin/1.0'
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
        const errorMessage = this.sanitizeErrorMessage(
          data?.error?.message || `HTTP ${response.status}`
        );
        new Notice(`OpenAI test failed: ${errorMessage}`);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as any).name === 'AbortError') {
        new Notice('OpenAI test timed out. Check your connection.');
      } else {
        const errorMessage = this.sanitizeErrorMessage(
          (error as any)?.message || 'Unknown error'
        );
        new Notice(`OpenAI test error: ${errorMessage}`);
      }
    }
  }

  private static sanitizeErrorMessage(message: string): string {
    return message
      .replace(/Bearer\s+sk-[A-Za-z0-9-_]+/gi, 'Bearer [REDACTED]')
      .replace(/sk-[A-Za-z0-9-_]{20,}/gi, '[API_KEY_REDACTED]')
      .replace(/api[_-]?key['":\s]*[A-Za-z0-9-_]+/gi, 'api_key: [REDACTED]');
  }
}