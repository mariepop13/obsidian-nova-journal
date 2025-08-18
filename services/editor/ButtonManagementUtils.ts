import { Editor } from 'obsidian';
import { ButtonCustomizationService } from './ButtonCustomizationService';
import { isDeepenButtonMarkup, isMoodAnalyzeButtonMarkup } from './ContentDetectionUtils';
import { deleteRangesInReverse } from './ContentCleanupUtils';

export function ensureBottomButtons(editor: Editor, label: string, settings?: any): void {
  removeExistingButtons(editor);
  insertBottomButtons(editor, label, settings);
}

function removeExistingButtons(editor: Editor): void {
  const buttonRanges = findAllButtonRanges(editor);
  deleteRangesInReverse(editor, buttonRanges);
}

function findAllButtonRanges(editor: Editor): Array<{ from: any; to: any }> {
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

function insertBottomButtons(editor: Editor, label: string, settings?: any): void {
  const insertionPoint = findButtonInsertionPoint(editor);
  const buttons = createButtonMarkup(label, settings);
  editor.replaceRange(buttons, insertionPoint.from, insertionPoint.to);
}

function findButtonInsertionPoint(editor: Editor) {
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

function createButtonMarkup(label: string, settings?: any): string {
  if (settings) {
    try {
      const config = ButtonCustomizationService.createFromSettings(settings);
      config.scope = 'note';
      const markup = ButtonCustomizationService.generateButtonMarkup(config);
      if (typeof markup === 'string' && markup.length) return markup;
    } catch (e) {
      // Fallback to default markup
    }
  }

  return `\n<button class="nova-deepen" data-scope="note">${label}</button> <button class="nova-mood-analyze">Analyze mood</button>\n`;
}
