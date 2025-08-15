import { Editor } from 'obsidian';
import { typewriterInsert, removeAnchorsInBlock, ensureBottomButtons, ensureUserPromptLine } from '../editor/NoteEditor';
import type { ButtonSettings } from './ConversationService';

export class ResponseInsertionService {
  private readonly userName: string;
  private readonly deepenButtonLabel: string;
  private readonly typewriterSpeed: 'slow' | 'normal' | 'fast';
  private readonly buttonSettings: ButtonSettings;

  constructor(
    userName: string,
    deepenButtonLabel: string,
    typewriterSpeed: 'slow' | 'normal' | 'fast',
    buttonSettings: ButtonSettings
  ) {
    this.userName = userName;
    this.deepenButtonLabel = deepenButtonLabel;
    this.typewriterSpeed = typewriterSpeed;
    this.buttonSettings = buttonSettings;
  }

  async insertTargetLineResponse(editor: Editor, buttonLine: number, response: string): Promise<void> {
    editor.replaceRange('**Nova**: \n', { line: buttonLine, ch: 0 });
    await typewriterInsert(editor, buttonLine, '**Nova**: ', response, this.typewriterSpeed);
  }

  async insertGeneralLineResponse(editor: Editor, line: number, response: string): Promise<void> {
    const anchorLine = this.findAnchorLine(editor, line);
    const scopeAttr = 'data-scope="note"';

    if (anchorLine !== null) {
      await this.insertAtExistingAnchor(editor, anchorLine, response, scopeAttr);
    } else {
      await this.insertAfterLine(editor, line, response, scopeAttr);
    }
  }

  async insertWholeNoteResponse(editor: Editor, response: string, label: string): Promise<void> {
    const anchorLine = this.findNoteScopeAnchor(editor);
    this.prepareUserLine(editor, anchorLine);

    if (anchorLine !== null) {
      await this.insertAtExistingAnchor(editor, anchorLine, response, 'data-scope="note"', label);
    } else {
      await this.insertAtEndOfNote(editor, response, label);
    }
  }

  findExistingButton(editor: Editor, line: number): number | null {
    const pattern = new RegExp(`^<a[^>]*class="nova-deepen"[^>]*data-line="${line}"[^>]*>.*</a>$`);
    
    for (let i = line + 1; i <= editor.lastLine(); i += 1) {
      const lineText = editor.getLine(i).trim();
      if (pattern.test(lineText)) {
        return i;
      }
      if (/^[^\s].*:/.test(lineText)) break;
    }
    return null;
  }

  createNewButton(editor: Editor, line: number): number {
    ensureBottomButtons(editor, this.deepenButtonLabel, this.buttonSettings);
    return editor.lastLine();
  }

  private findAnchorLine(editor: Editor, startLine: number): number | null {
    for (let i = startLine + 1; i <= editor.lastLine(); i += 1) {
      const lineText = editor.getLine(i);
      if (/<(a|button)\b[^>]*class=("[^"]*\bnova-deepen\b[^"]*"|'[^']*\bnova-deepen\b[^']*')[^>]*>/.test(lineText)) return i;
      if (/^[^\s].*:/.test(lineText)) break;
    }
    return null;
  }

  private findNoteScopeAnchor(editor: Editor): number | null {
    for (let i = 0; i <= editor.lastLine(); i += 1) {
      const lineText = editor.getLine(i);
      if (/(<(a|button))\b[^>]*class=("[^"]*\bnova-deepen\b[^"]*"|'[^']*\bnova-deepen\b[^']*')[^>]*data-scope=("|')note\4/.test(lineText)) {
        return i;
      }
    }
    return null;
  }

  private prepareUserLine(editor: Editor, anchorLine: number | null): void {
    const namePrefix = `**${this.userName || 'You'}** (you):`;
    let userLineIdx = anchorLine !== null ? anchorLine - 1 : editor.lastLine();
    
    while (userLineIdx >= 0 && editor.getLine(userLineIdx).trim().length === 0) {
      userLineIdx -= 1;
    }
    
    if (userLineIdx >= 0) {
      const rawLine = editor.getLine(userLineIdx);
      const trimmed = rawLine.trim();
      
      if (trimmed && !trimmed.startsWith(namePrefix)) {
        editor.replaceRange(
          `${namePrefix} ${trimmed}`,
          { line: userLineIdx, ch: 0 },
          { line: userLineIdx, ch: rawLine.length }
        );
      }
    }
  }

  private async insertAtExistingAnchor(
    editor: Editor, 
    anchorLine: number, 
    response: string, 
    _scopeAttr: string, 
    label?: string
  ): Promise<void> {
    editor.replaceRange('**Nova**: \n', { line: anchorLine, ch: 0 }, { line: anchorLine, ch: editor.getLine(anchorLine).length });
    
    await typewriterInsert(editor, anchorLine, '**Nova**: ', response, this.typewriterSpeed);
    removeAnchorsInBlock(editor, anchorLine);
    ensureBottomButtons(editor, label || this.deepenButtonLabel, this.buttonSettings);
    ensureUserPromptLine(editor, this.userName);
  }

  private async insertAfterLine(editor: Editor, line: number, response: string, scopeAttr: string): Promise<void> {
    editor.replaceRange('**Nova**: \n', { line: line + 1, ch: 0 });
    await typewriterInsert(editor, line + 1, '**Nova**: ', response, this.typewriterSpeed);
    removeAnchorsInBlock(editor, line);
    ensureBottomButtons(editor, this.deepenButtonLabel, this.buttonSettings);
    ensureUserPromptLine(editor, this.userName);
  }

  private async insertAtEndOfNote(editor: Editor, response: string, label: string): Promise<void> {
    const lastLine = editor.lastLine();
    const needsBreak = editor.getValue().trim().length > 0 ? '\n\n' : '';
    const insertPos = { line: lastLine, ch: editor.getLine(lastLine).length };
    
    editor.replaceRange(`${needsBreak}**Nova**: \n`, insertPos);
    const answerLine = editor.lastLine();
    
    await typewriterInsert(editor, answerLine, '**Nova**: ', response, this.typewriterSpeed);
    removeAnchorsInBlock(editor, answerLine);
    ensureBottomButtons(editor, label, this.buttonSettings);
    ensureUserPromptLine(editor, this.userName);
  }
}
