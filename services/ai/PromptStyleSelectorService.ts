import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';

export class PromptStyleSelectorService {
  constructor(private readonly settings: NovaJournalSettings) {}

  async recommendStyle(noteText: string, mood?: Partial<MoodData>): Promise<PromptStyle | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    const systemPrompt = `You decide the most appropriate journaling prompt STYLE for the user's current context. You MUST return ONLY a compact JSON object with a single property.

Return exactly:
{ "recommended_style": "reflective"|"gratitude"|"planning"|"dreams" }

Guidelines (apply semantically in ANY language):
- dreams: if content refers to dreams/nightmares, sleep themes, waking reflections about dreams
- gratitude: if tone is appreciative/thankful or focused on positives
- planning: if content is about tasks, tomorrow, scheduling, goals, next steps
- reflective: default; general introspection, mixed feelings, analysis of events

Never add any text before or after the JSON.`;

    const moodFragment = mood ? `\n\nFrontmatter mood (optional):\n${JSON.stringify(mood)}` : '';
    const userPrompt = `Note content (any language):\n${noteText}${moodFragment}`;

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(200, this.settings.aiMaxTokens || 200),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel || ''
      });

      let jsonText = '';
      if (typeof response === 'string') {
        jsonText = response;
      } else if (response && typeof response === 'object') {
        jsonText = response.content || response?.choices?.[0]?.message?.content || JSON.stringify(response);
      }
      try {
        const parsed = JSON.parse(jsonText);
        const style = String(parsed?.recommended_style || '').toLowerCase();
        if (style === 'reflective' || style === 'gratitude' || style === 'planning' || style === 'dreams') {
          return style as PromptStyle;
        }
      } catch {
        // ignore parse errors
      }
      return null;
    } catch {
      return null;
    }
  }
}


