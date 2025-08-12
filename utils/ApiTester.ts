import { Notice } from 'obsidian';

export class ApiTester {
  static async testOpenAIConnection(apiKey: string): Promise<void> {
    if (!apiKey) {
      new Notice('Set your OpenAI API key first.');
      return;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        const modelCount = Array.isArray(data?.data) ? data.data.length : undefined;
        const message = `OpenAI test: OK${modelCount ? ` (${modelCount} models accessible)` : ''}`;
        new Notice(message);
      } else {
        const errorMessage = (data?.error?.message || `${response.status} ${response.statusText}`).toString();
        new Notice(`OpenAI test failed: ${errorMessage}`);
      }
    } catch (error) {
      const errorMessage = (error as any)?.message || String(error);
      new Notice(`OpenAI test error: ${errorMessage}`);
    }
  }
}