import type { NovaJournalSettings } from '../../settings/PluginSettings';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { MoodData } from '../rendering/FrontmatterService';
import { chat } from '../../ai/AiClient';
import { EmbeddingService } from './EmbeddingService';
import { EnhancedPromptGenerationService } from './EnhancedPromptGenerationService';

export class PromptGenerationService {
  private enhancedService: EnhancedPromptGenerationService;

  constructor(private readonly settings: NovaJournalSettings) {
    this.enhancedService = new EnhancedPromptGenerationService(settings);
  }

  async generateOpeningPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>
  ): Promise<string | null> {
    if (!this.settings.aiEnabled || !this.settings.aiApiKey) return null;

    try {
      if (mood?.dominant_emotions && mood.dominant_emotions.length > 0) {
        return await this.enhancedService.generateEmotionallyAwarePrompt(style, noteText, mood);
      }
      
      if (mood?.tags && mood.tags.length > 0) {
        return await this.enhancedService.generateThematicPrompt(style, noteText, mood.tags);
      }
      
      return await this.enhancedService.generateContextualPrompt(style, noteText, mood, {
        prioritizeRecent: true,
        includeEmotionalContext: true,
        includeThematicContext: true,
        maxContextChunks: 3
      });
    } catch (error) {
      console.error('[PromptGenerationService] Enhanced generation failed, falling back to legacy', error);
      return this.generateLegacyPrompt(style, noteText, mood);
    }
  }

  private async generateLegacyPrompt(
    style: PromptStyle,
    noteText: string,
    mood?: Partial<MoodData>
  ): Promise<string | null> {

    const systemPrompt = `Generate ONE simple journaling question based ONLY on the current note content, in the user's language.

CRITICAL RULES:
- Output ONLY the question text (no quotes/labels).
- One sentence, concise (<= 25 words).
- Quote or reference EXACT details from the notes context when relevant.
- Use real temporal references from the context (like [il y a 3 jours]).
- DO NOT invent connections, emotions, or cause-effect relationships.
- DO NOT assume feelings or situations not explicitly stated.

What TO do:
- Reference specific people, events, or facts directly mentioned in past notes
- Use actual temporal markers provided in the context
- Ask about evolution or change without assuming what happened before
- Stay factual and avoid emotional suppositions

What NOT to do:
- Do not assume stress, emotions, or feelings not explicitly mentioned
- Do not create cause-effect relationships ("after feeling X, then Y happened")
- Do not suppose the user's state of mind or motivations

Styles:
- reflective: simple self-inquiry about the current topic
- gratitude: focus on appreciation related to current topic
- planning: next steps for current situation
- dreams: exploration of current dream content`;

    let ragContext = '';
    try {
      if (noteText && noteText.trim().length > 0) {
        const appRef = (window as any)?.app;
        if (appRef) {
          const embeddingService = new EmbeddingService(appRef, this.settings);
          const top = await embeddingService.topK(noteText, 3);
          if (Array.isArray(top) && top.length > 0) {
            const enriched = top.map((t, i) => {
              const preview = (t.text || '').substring(0, 400);
              return `${i + 1}. ${preview}...`;
            }).join('\n');
            ragContext = `\n\nYour recent notes context (use specific details when relevant):\n${enriched}`;
          }
        }
      }
    } catch (err) {
      console.error('[PromptGenerationService] RAG fetch failed', err);
    }

    const moodFragment = mood ? `\n\nFrontmatter mood (optional, JSON):\n${JSON.stringify(mood)}` : '';
    const userPrompt = `Style: ${style}\n\nCurrent note content:\n${noteText || '(empty)'}${moodFragment}${ragContext}

Generate a question that:
1. References EXACT facts or events from past notes when relevant to current topic
2. Uses temporal markers without assuming emotional context
3. Asks about change or evolution without supposing what the past state was
4. Examples: "You mentioned [person] [timeframe] - what has changed?" NOT "after feeling [emotion]..."
5. Be factual, neutral, and avoid emotional interpretations`;

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


