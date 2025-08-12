import type { PromptStyle } from '../prompt/PromptRegistry';

export type InsertionLocation = 'cursor' | 'top' | 'bottom';

export interface NovaJournalSettings {
  promptStyle: PromptStyle;
  insertLocation: InsertionLocation;
  addSectionHeading: boolean;
  sectionHeading: string;
  dailyNoteFolder: string;
  dailyNoteFormat: string; // Limited support: YYYY-MM-DD
  promptTemplate: string; // If provided, used to render the inserted block
  preventDuplicateForDay: boolean;
  aiEnabled: boolean;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
  deepenButtonLabel: string;
  userName: string;
  aiDebug: boolean;
  defaultDeepenScope: 'line' | 'note';
  aiMaxTokens: number;
  aiRetryCount: number;
  aiFallbackModel: string;
}

export const DEFAULT_SETTINGS: NovaJournalSettings = {
  promptStyle: 'reflective',
  insertLocation: 'cursor',
  addSectionHeading: true,
  sectionHeading: '## Journal Prompt',
  dailyNoteFolder: 'Journal',
  dailyNoteFormat: 'YYYY-MM-DD',
  promptTemplate: '**Nova**: {{prompt}}\n\n{{user_line}}\n\n<a href="#" class="nova-deepen" data-scope="note">Explore more</a>',
  preventDuplicateForDay: true,
  aiEnabled: false,
  aiApiKey: '',
  aiModel: 'gpt-5-mini',
  aiSystemPrompt: 'You are Nova, a concise reflective journaling companion. Respond in 1-3 short sentences that deepen the user\'s thought with empathy and specificity.',
  deepenButtonLabel: 'Explore more',
  userName: 'You',
  aiDebug: false,
  defaultDeepenScope: 'line',
  aiMaxTokens: 256,
  aiRetryCount: 2,
  aiFallbackModel: '',
};

export function normalizeSettings(input: NovaJournalSettings): NovaJournalSettings {
  const s: NovaJournalSettings = { ...DEFAULT_SETTINGS, ...input };
  const tpl = (s.promptTemplate || '').replace(/\s+$/, '');
  const allowedFormats = new Set(['YYYY-MM-DD', 'YYYY-MM-DD_HH-mm']);
  const dailyFmt = allowedFormats.has(s.dailyNoteFormat) ? s.dailyNoteFormat : DEFAULT_SETTINGS.dailyNoteFormat;
  return { ...s, promptTemplate: tpl, dailyNoteFormat: dailyFmt };
}


