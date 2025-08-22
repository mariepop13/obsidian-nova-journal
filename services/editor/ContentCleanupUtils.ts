import { Editor, EditorPosition } from 'obsidian';
import { RegexHelpers } from '../utils/RegexHelpers';

export function removeDateHeadingInEditor(editor: Editor): void {
  const rangesToDelete = findDateHeadingRanges(editor);
  deleteRangesInReverse(editor, rangesToDelete);
}

function findDateHeadingRanges(editor: Editor): Array<{
  from: { line: number; ch: number };
  to: { line: number; ch: number };
}> {
  const ranges = [];
  const lastLine = editor.lastLine();

  for (let line = 0; line <= lastLine; line += 1) {
    const text = editor.getLine(line).trim();
    if (RegexHelpers.isDateHeading(text)) {
      const range = createDateHeadingRange(editor, line, lastLine);
      ranges.push(range);
    }
  }

  return ranges;
}

function createDateHeadingRange(editor: Editor, line: number, lastLine: number) {
  const nextIsBlank = line + 1 <= lastLine && editor.getLine(line + 1).trim() === '';
  const from = { line, ch: 0 };
  const to = nextIsBlank
    ? { line: line + 1, ch: editor.getLine(line + 1).length }
    : { line, ch: editor.getLine(line).length };
  return { from, to };
}

export function removeAnchorsInBlock(editor: Editor, startLine: number): void {
  const blockEnd = findBlockEnd(editor, startLine);
  const anchorRanges = findAnchorRanges(editor, startLine, blockEnd);
  deleteRangesInReverse(editor, anchorRanges);
}

function findBlockEnd(editor: Editor, startLine: number): number {
  const lastLine = editor.lastLine();
  let end = startLine;
  let i = startLine + 1;

  for (; i <= lastLine; i += 1) {
    const text = editor.getLine(i);
    if (RegexHelpers.isBlankLine(text) || RegexHelpers.isSpeakerLine(text)) {
      end = i - 1;
      break;
    }
    end = i;
  }

  for (; i <= lastLine; i += 1) {
    const text = editor.getLine(i);
    if (RegexHelpers.isSpeakerLine(text) || !RegexHelpers.isBlankLine(text)) {
      break;
    }
    end = i;
  }

  return end;
}

function findAnchorRanges(editor: Editor, start: number, end: number): Array<{ from: EditorPosition; to: EditorPosition }> {
  const ranges = [];

  for (let line = start; line <= end; line += 1) {
    const text = editor.getLine(line);
    if (RegexHelpers.isAnchorMarkup(text)) {
      ranges.push({
        from: { line, ch: 0 },
        to: { line, ch: text.length },
      });
    }
  }

  return ranges;
}

export function deleteRangesInReverse(editor: Editor, ranges: Array<{ from: EditorPosition; to: EditorPosition }>): void {
  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    const range = ranges[i];
    editor.replaceRange('', range.from, range.to);
  }
}
