import { Editor } from 'obsidian';
import type { EnhancedInsertionLocation } from '../settings/PluginSettings';

export function getDeepenSource(editor: Editor, preferredLine?: number): { text: string; line: number } | null {
  if (preferredLine !== undefined) {
    const t = editor.getLine(preferredLine)?.trim();
    if (t) return { text: t, line: preferredLine };
  }
  const sel = editor.getSelection()?.trim();
  if (sel) {
    const cursor = editor.getCursor();
    return { text: sel, line: cursor.line };
  }
  let line = editor.getCursor().line;
  while (line >= 0) {
    const txt = editor.getLine(line).trim();
    if (txt) return { text: txt, line };
    line -= 1;
  }
  return null;
}

export function insertAtLocation(editor: Editor, text: string, location: EnhancedInsertionLocation, belowHeadingName?: string): void {
  const ensureTrailingNewline = (s: string) => (s.endsWith('\n') ? s : s + '\n');
  const block = ensureTrailingNewline(text);
  if (location === 'top') {
    const current = editor.getValue();
    editor.setValue(`${block}${current.replace(/^\n+/, '')}`);
    return;
  }
  if (location === 'bottom') {
    const lastLine = editor.lastLine();
    const lastLineText = editor.getLine(lastLine);
    const needsLeadingBreak = lastLineText.trim().length > 0;
    const insertText = (needsLeadingBreak ? '\n\n' : '') + block;
    const to = { line: lastLine, ch: lastLineText.length };
    editor.replaceRange(insertText, to);
    return;
  }
  if (location === 'below-heading') {
    const target = (belowHeadingName || '').trim();
    const last = editor.lastLine();
    let insertLine = -1;
    const headingRegex = target ? new RegExp(`^\s*#{1,6}\s*${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*$`) : null;
    for (let i = 0; i <= last; i += 1) {
      const txt = editor.getLine(i);
      if (headingRegex ? headingRegex.test(txt.trim()) : /^\s*#{1,6}\s*.+$/.test(txt.trim())) {
        insertLine = i + 1;
      }
      if (insertLine >= 0) break;
    }
    if (insertLine < 0) {
      editor.replaceSelection(block);
      return;
    }
    editor.replaceRange(`\n${block}`, { line: insertLine, ch: 0 });
    return;
  }
  editor.replaceSelection(block);
}

export async function typewriterInsert(editor: Editor, line: number, prefix: string, text: string, speed: 'slow' | 'normal' | 'fast' = 'normal'): Promise<void> {
  const tokens = text
    .split(/([.!?]+|\n+)/)
    .reduce<string[]>((acc, part) => {
      if (!part) return acc;
      const last = acc.length ? acc[acc.length - 1] : '';
      if (/\n+/.test(part)) {
        acc.push(part);
      } else if (/[.!?]+/.test(part) && last && !/\n+/.test(last)) {
        acc[acc.length - 1] = last + part;
      } else {
        acc.push(part.trim());
      }
      return acc;
    }, [])
    .filter(p => p.length > 0);

  let current = prefix;
  const maxMs = 4000;
  const stepDelay = speed === 'slow' ? 90 : speed === 'fast' ? 25 : 50;
  const start = Date.now();
  for (let i = 0; i < tokens.length; i += 1) {
    if (line > editor.lastLine() || Date.now() - start > maxMs) break;
    const piece = tokens[i];
    const sep = i === 0 ? '' : (piece === '\n' ? '' : (/\n+/.test(tokens[i - 1]) ? '' : ' '));
    current += (/\n+/.test(piece) ? piece : sep + piece);
    editor.replaceRange(current, { line, ch: 0 }, { line, ch: editor.getLine(line).length });
    await new Promise(r => setTimeout(r, stepDelay));
  }
  if (line <= editor.lastLine()) {
    editor.replaceRange(current + '\n', { line, ch: 0 }, { line, ch: editor.getLine(line).length });
  }
}

export function removeDateHeadingInEditor(editor: Editor): void {
  const dateHeadingRegex = /^#{1,6}\s*\d{4}-\d{2}-\d{2}\s*$/;
  const last = editor.lastLine();
  const rangesToDelete: { from: { line: number; ch: number }; to: { line: number; ch: number } }[] = [];
  for (let line = 0; line <= last; line += 1) {
    const text = editor.getLine(line).trim();
    if (dateHeadingRegex.test(text)) {
      const nextIsBlank = line + 1 <= last && editor.getLine(line + 1).trim() === '';
      const from = { line, ch: 0 };
      const to = nextIsBlank ? { line: line + 1, ch: editor.getLine(line + 1).length } : { line, ch: editor.getLine(line).length };
      rangesToDelete.push({ from, to });
    }
  }
  for (let i = rangesToDelete.length - 1; i >= 0; i -= 1) {
    const r = rangesToDelete[i];
    editor.replaceRange('', r.from, r.to);
  }
}


export function generateAnchorId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `conv-${Date.now().toString(36)}-${rnd}`;
}

export function removeAnchorsInBlock(editor: Editor, startLine: number): void {
  const last = editor.lastLine();
  const isSpeaker = (t: string) => /^[^\s].*:\s*$/.test(t);
  const isBlank = (t: string) => t.trim().length === 0;
  const isAnchor = (t: string) => /<a[^>]*class=\"nova-deepen\"[^>]*>/.test(t);
  let end = startLine;
  let i = startLine + 1;
  for (; i <= last; i += 1) {
    const t = editor.getLine(i);
    if (isBlank(t) || isSpeaker(t)) { end = i - 1; break; }
    end = i;
  }
  for (; i <= last; i += 1) {
    const t = editor.getLine(i);
    if (isSpeaker(t)) break;
    if (!isBlank(t)) break;
    end = i;
  }
  const toDelete: { from: { line: number; ch: number }; to: { line: number; ch: number } }[] = [];
  for (let j = startLine; j <= end; j += 1) {
    const t = editor.getLine(j);
    if (isAnchor(t)) {
      toDelete.push({ from: { line: j, ch: 0 }, to: { line: j, ch: t.length } });
    }
  }
  for (let k = toDelete.length - 1; k >= 0; k -= 1) {
    const r = toDelete[k];
    editor.replaceRange('', r.from, r.to);
  }
}

export function insertAnchorBelow(editor: Editor, line: number, scopeAttr: string, id: string, label: string): number {
  const markup = `\n<a href="#" class="nova-deepen" ${scopeAttr} data-id="${id}">${label}</a>\n`;
  editor.replaceRange(markup, { line: line + 1, ch: 0 });
  return line + 2;
}


