import type { PromptStyle } from '../prompt/PromptRegistry';

export type InsertionLocation = 'cursor' | 'top' | 'bottom';

export interface NovaJournalSettings {
  promptStyle: PromptStyle;
  insertLocation: InsertionLocation;
  addSectionHeading: boolean;
  sectionHeading: string;
  addDateHeading: boolean;
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
}

export const DEFAULT_SETTINGS: NovaJournalSettings = {
  promptStyle: 'reflective',
  insertLocation: 'cursor',
  addSectionHeading: true,
  sectionHeading: '## Prompt',
  addDateHeading: false,
  dailyNoteFolder: 'Journal',
  dailyNoteFormat: 'YYYY-MM-DD',
  promptTemplate: '',
  preventDuplicateForDay: true,
  aiEnabled: false,
  aiApiKey: '',
  aiModel: 'gpt-5-mini',
  aiSystemPrompt: 'You are Nova, a concise reflective journaling companion. Respond in 1-3 short sentences that deepen the user\'s thought with empathy and specificity.',
  deepenButtonLabel: 'Explore more',
  userName: 'Marie',
  aiDebug: false,
  defaultDeepenScope: 'line',
};


