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
};


