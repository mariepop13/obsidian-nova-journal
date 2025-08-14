import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';
import { EmbeddingService } from './EmbeddingService';

export class PromptGenerationService {
  constructor(private readonly settings: NovaJournalSettings) {}

  async generateOpeningPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>
  ): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    const systemPrompt = `Generate ONE highly personalized journaling question using the user's own context and patterns, in their language.

Rules:
- Output ONLY the question text (no quotes/labels).
- One sentence, concise (<= 30 words).
- MUST reference specific elements from the personal context when available.
- MUST include temporal references like "comme tu mentionnais hier/la semaine dernière" when relevant.
- Use the user's language from the note content.

Personalization examples:
- "Comme tu mentionnais hier avec [personne], comment cette conversation a-t-elle changé ta perspective ?"
- "Ce projet dont tu parlais la semaine dernière, quelle première action pourrait débloquer la situation ?"
- "Tu évoquais cette difficulté récemment - qu'est-ce qui a évolué depuis ?"

Styles:
- reflective: deep self-inquiry connecting past and present
- gratitude: appreciative focus on specific positives
- planning: actionable next steps for specific situations
- dreams: exploration of symbols/feelings from specific dreams`;

    let ragContext = '';
    try {
      const embeddingService = new EmbeddingService((window as any).app, this.settings);
      const top = await embeddingService.topK(noteText || 'general', 5);
      
      if (top.length > 0) {
        const joined = top.map((t, i) => `${i+1}. ${t.text.substring(0, 300)}...`).join('\n');
        ragContext = `\n\nPersonal context from your recent notes (reference these specifically):\n${joined}`;
      }
    } catch {}

    const moodFragment = mood ? `\n\nFrontmatter mood (optional, JSON):\n${JSON.stringify(mood)}` : '';
    const userPrompt = `Style: ${style}\n\nCurrent note content:\n${noteText || '(empty)'}${moodFragment}${ragContext}

Generate a question that specifically references elements from the personal context above, making clear connections to the current situation.`;

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


