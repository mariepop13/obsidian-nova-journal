import { Editor, EditorPosition } from 'obsidian';
import { ButtonCustomizationService } from './ButtonCustomizationService';
import type { ButtonPosition, ButtonStyle, NovaJournalSettings } from '../../settings/PluginSettings';
import { isDeepenButtonMarkup, isMoodAnalyzeButtonMarkup } from './ContentDetectionUtils';
import { deleteRangesInReverse } from './ContentCleanupUtils';

interface ButtonSettings {
  buttonStyle?: ButtonStyle;
  buttonPosition?: ButtonPosition;
  moodButtonLabel?: string;
  showMoodButton?: boolean;
  buttonTheme?: string;
  deepenButtonLabel?: string;
}

export function ensureBottomButtons(editor: Editor, label: string, settings?: ButtonSettings): void {
  removeExistingButtons(editor);
  insertBottomButtons(editor, label, settings);
}

function removeExistingButtons(editor: Editor): void {
  const buttonRanges = findAllButtonRanges(editor);
  deleteRangesInReverse(editor, buttonRanges);
}

function findAllButtonRanges(editor: Editor): Array<{ from: EditorPosition; to: EditorPosition }> {
  const ranges = [];
  const lastLine = editor.lastLine();

  for (let i = 0; i <= lastLine; i += 1) {
    const text = editor.getLine(i);
    if (isDeepenButtonMarkup(text) || isMoodAnalyzeButtonMarkup(text)) {
      ranges.push({
        from: { line: i, ch: 0 },
        to: { line: i, ch: text.length },
      });
    }
  }

  return ranges;
}

function insertBottomButtons(editor: Editor, label: string, settings?: ButtonSettings): void {
  const insertionPoint = findButtonInsertionPoint(editor);
  const buttons = createButtonMarkup(label, settings);
  editor.replaceRange(buttons, insertionPoint.from, insertionPoint.to);
}

function findButtonInsertionPoint(editor: Editor): { from: EditorPosition; to: EditorPosition } {
  const endLine = editor.lastLine();
  const lastNonEmpty = findLastNonEmptyLine(editor, endLine);
  const insertLine = Math.max(0, lastNonEmpty + 1);
  const insertPos = { line: insertLine, ch: 0 };

  return {
    from: insertPos,
    to: insertPos,
  };
}

function findLastNonEmptyLine(editor: Editor, endLine: number): number {
  for (let i = endLine; i >= 0; i -= 1) {
    if (editor.getLine(i).trim().length > 0) {
      return i;
    }
  }
  return -1;
}

function createButtonMarkup(label: string, settings?: ButtonSettings): string {
  if (settings) {
    try {
      const fullSettings = {
        deepenButtonLabel: settings.deepenButtonLabel || 'Deepen',
        moodButtonLabel: settings.moodButtonLabel || 'Mood',
        buttonStyle: settings.buttonStyle || 'default',
        buttonPosition: settings.buttonPosition || 'bottom',
        buttonTheme: settings.buttonTheme || 'primary',
        showMoodButton: settings.showMoodButton ?? true,
      } as Partial<NovaJournalSettings>;
      const config = ButtonCustomizationService.createFromSettings(fullSettings as NovaJournalSettings);
      config.scope = 'note';
      const markup = ButtonCustomizationService.generateButtonMarkup(config);
      if (typeof markup === 'string' && markup.length) return markup;
    } catch {
      // Fallback to default markup
    }
  }

  return `\n<button class="nova-deepen" data-scope="note">${label}</button> <button class="nova-mood-analyze">Analyze mood</button>\n`;
}
