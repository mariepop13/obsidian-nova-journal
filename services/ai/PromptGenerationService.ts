import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';

export class PromptGenerationService {
  constructor(private readonly settings: NovaJournalSettings) {}

  async generateOpeningPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>
  ): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    const systemPrompt = `Generate ONE short journaling question tailored to the user's current context, in the user's language.

Rules:
- Output ONLY the question text (no quotes/no labels).
- One sentence, concise (<= 20 words).
- Match the user's language from the note content.

Styles:
- reflective: reflective self-inquiry
- gratitude: appreciative focus on positives
- planning: next steps/tomorrow/priorities/obstacles
- dreams: dreams/nightmares/symbols/waking feelings`;

    const moodFragment = mood ? `\n\nFrontmatter mood (optional, JSON):\n${JSON.stringify(mood)}` : '';
    const userPrompt = `Style: ${style}\n\nNote content (any language):\n${noteText || '(empty)'}${moodFragment}`;

    try {
      const response = await chat({
        apiKey: this.settings.aiApiKey,
        model: this.settings.aiModel,
        systemPrompt,
        userText: userPrompt,
        maxTokens: Math.min(60, this.settings.aiMaxTokens || 60),
        debug: this.settings.aiDebug,
        retryCount: this.settings.aiRetryCount,
        fallbackModel: this.settings.aiFallbackModel || ''
      });

      const text = (response || '').trim();
      if (!text) return null;

      // Heuristic cleanup: strip surrounding quotes if any model returns them
      const cleaned = text.replace(/^"|"$/g, '').trim();
      return cleaned || null;
    } catch {
      return null;
    }
  }
}


