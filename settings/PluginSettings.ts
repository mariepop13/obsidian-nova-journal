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
  aiMaxTokens: number;
  aiRetryCount: number;
  aiFallbackModel: string;
}

export const DEFAULT_SETTINGS: NovaJournalSettings = {
  promptStyle: 'reflective',
  insertLocation: 'cursor',
  addSectionHeading: true,
  sectionHeading: '## Prompt',
  addDateHeading: false,
  dailyNoteFolder: 'Journal',
  dailyNoteFormat: 'YYYY-MM-DD_HH-mm',
  promptTemplate: '**Nova**: {{prompt}}\n\n\n<a href="#" class="nova-deepen" data-scope="note">Explore more</a>',
  preventDuplicateForDay: true,
  aiEnabled: false,
  aiApiKey: '',
  aiModel: 'gpt-5-mini',
  aiSystemPrompt: 'You are Nova, a concise reflective journaling companion. Respond in 1-3 short sentences that deepen the user\'s thought with empathy and specificity.',
  deepenButtonLabel: 'Explore more',
  userName: 'Marie',
  aiDebug: false,
  defaultDeepenScope: 'line',
  aiMaxTokens: 512,
  aiRetryCount: 2,
  aiFallbackModel: '',
};

export function normalizeSettings(input: NovaJournalSettings): NovaJournalSettings {
  const s: NovaJournalSettings = { ...DEFAULT_SETTINGS, ...input };
  let tpl = (s.promptTemplate || '').replace(/\s+$/, '');
  const hasAnchor = /class=\"nova-deepen\"/.test(tpl) || /class="nova-deepen"/.test(tpl);
  if (!hasAnchor) {
    const scopeAttr = s.defaultDeepenScope === 'note' ? 'data-scope="note"' : 'data-line="0"';
    tpl = `${tpl}\n\n\n<a href="#" class="nova-deepen" ${scopeAttr}>${s.deepenButtonLabel}</a>`;
  }
  tpl = tpl.replace(/\n{1,2}(<a[^>]*class=\"nova-deepen\")/g, `\n\n\n$1`).replace(/\n{1,2}(<a[^>]*class="nova-deepen")/g, `\n\n\n$1`);
  if (!/\*\*Nova\*\*:\s*/.test(tpl)) {
    tpl = tpl.replace(/\{\{\s*prompt\s*\}\}/g, `**Nova**: {{prompt}}`);
  }
  const dailyFmt = s.dailyNoteFormat === 'YYYY-MM-DD' ? 'YYYY-MM-DD_HH-mm' : s.dailyNoteFormat;
  return { ...s, promptTemplate: tpl, dailyNoteFormat: dailyFmt };
}


