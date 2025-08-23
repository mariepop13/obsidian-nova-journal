import { Editor } from 'obsidian';
import type { EnhancedInsertionLocation } from '../../settings/PluginSettings';
import { RegexHelpers } from '../utils/RegexHelpers';

export function insertAtLocation(
  editor: Editor,
  text: string,
  location: EnhancedInsertionLocation,
  belowHeadingName?: string
): void {
  const block = ensureTrailingNewline(text);

  switch (location) {
    case 'top':
      insertAtTop(editor, block);
      break;
    case 'bottom':
      insertAtBottom(editor, block);
      break;
    case 'below-heading':
      insertBelowHeading(editor, block, belowHeadingName);
      break;
    default:
      editor.replaceSelection(block);
  }
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : text + '\n';
}

function insertAtTop(editor: Editor, block: string): void {
  const current = editor.getValue();
  editor.setValue(`${block}${current.replace(/^\n+/, '')}`);
}

function insertAtBottom(editor: Editor, block: string): void {
  const lastLine = editor.lastLine();
  const lastLineText = editor.getLine(lastLine);
  const needsLeadingBreak = lastLineText.trim().length > 0;
  const insertText = (needsLeadingBreak ? '\n\n' : '') + block;
  const to = { line: lastLine, ch: lastLineText.length };
  editor.replaceRange(insertText, to);
}

function insertBelowHeading(editor: Editor, block: string, belowHeadingName?: string): void {
  try {
    const insertLine = findHeadingInsertionLine(editor, belowHeadingName);

    if (insertLine < 0) {
      editor.replaceSelection(block);
      return;
    }

    insertAtHeadingPosition(editor, block, insertLine);
  } catch (regexError) {
    handleHeadingRegexError(editor, block, regexError);
  }
}

function findHeadingInsertionLine(editor: Editor, headingName?: string): number {
  const target = (headingName ?? '').trim();
  const headingRegex = RegexHelpers.createHeadingRegex(target);
  const lastLine = editor.lastLine();
  let insertLine = -1;

  for (let i = 0; i <= lastLine; i += 1) {
    const lineText = editor.getLine(i);
    if (headingRegex.test(lineText.trim())) {
      insertLine = i + 1;
      if (target) break;
    }
  }

  return insertLine;
}

function insertAtHeadingPosition(editor: Editor, block: string, insertLine: number): void {
  const insertPos = { line: insertLine, ch: 0 };
  const needsNewline = insertLine <= editor.lastLine() && editor.getLine(insertLine).trim().length > 0;
  const insertText = needsNewline ? `${block}\n` : block;
  editor.replaceRange(insertText, insertPos);
}

function handleHeadingRegexError(editor: Editor, block: string, _regexError: Error): void {
  editor.replaceSelection(block);
}
