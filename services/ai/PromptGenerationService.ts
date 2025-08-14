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

    const systemPrompt = `Generate ONE journaling question that builds on the user's current note and recent context, in their language.

Rules:
- Output ONLY the question text (no quotes/labels).
- One sentence, concise (<= 25 words).
- Stay CLOSELY related to the current note topic.
- Use EXACT temporal references from the personal context (dates shown in brackets).
- Only reference past elements that are directly relevant to the current topic.

Personalization approach:
- If current note mentions "conversation with brother" → find past notes about brother/family relationships
- If current note mentions "work project" → find past notes about same project/work stress
- Use the EXACT date indicators from personal context [hier], [il y a 3 jours], etc.

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
        const enriched = top.map((t, i) => {
          const preview = t.text.substring(0, 400);
          return `${i+1}. ${preview}...`;
        }).join('\n');
        ragContext = `\n\nRelevant personal context (use ONLY if directly related to current topic):\n${enriched}`;
      }
    } catch {}

    const moodFragment = mood ? `\n\nFrontmatter mood (optional, JSON):\n${JSON.stringify(mood)}` : '';
    const userPrompt = `Style: ${style}\n\nCurrent note content:\n${noteText || '(empty)'}${moodFragment}${ragContext}

Generate a question that:
1. Focuses PRIMARILY on the current note topic
2. Only references past context if directly relevant to the same subject
3. Uses exact temporal markers from the context [hier], [il y a X jours]
4. Avoids mixing unrelated past topics with current reflection`;

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


