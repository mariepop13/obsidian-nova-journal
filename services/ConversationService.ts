import { Editor, Notice } from 'obsidian';
import { chat } from '../ai/AiClient';
import type { NovaJournalSettings } from '../settings/PluginSettings';
import { getDeepenSource, typewriterInsert, removeAnchorsInBlock, ensureBottomButtons, ensureUserPromptLine } from './NoteEditor';
import { ConversationResponseService } from './ConversationResponseService';
import { RegexHelpers } from './RegexHelpers';
import { AINotConfiguredError, EmptyNoteError, NoTextToDeepenError, AIServiceError } from './ErrorTypes';

export interface ConversationContext {
  apiKey: string;
  model: string;
  systemPrompt: string;
  maxTokens: number;
  debug: boolean;
  retryCount: number;
  fallbackModel: string;
  userName: string;
  deepenButtonLabel: string;
  typewriterSpeed: 'slow' | 'normal' | 'fast';
}

export class ConversationService {
  private readonly context: ConversationContext;

  constructor(settings: NovaJournalSettings) {
    this.context = {
      apiKey: settings.aiApiKey,
      model: settings.aiModel,
      systemPrompt: settings.aiSystemPrompt,
      maxTokens: settings.aiMaxTokens,
      debug: settings.aiDebug,
      retryCount: settings.aiRetryCount,
      fallbackModel: settings.aiFallbackModel,
      userName: settings.userName,
      deepenButtonLabel: settings.deepenButtonLabel,
      typewriterSpeed: settings.typewriterSpeed,
    };
  }

  async deepenLine(editor: Editor, targetLine?: number): Promise<void> {
    try {
      this.ensureAIConfigured();

      const source = getDeepenSource(editor, targetLine);
      if (!source) {
        throw new NoTextToDeepenError();
      }

      const { text: lastLineText, line } = source;

      if (typeof targetLine === 'number') {
        await this.handleTargetLineDeepen(editor, line, lastLineText);
      } else {
        await this.handleGeneralLineDeepen(editor, line, lastLineText);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async deepenWholeNote(editor: Editor, label: string): Promise<void> {
    try {
      this.ensureAIConfigured();

      const content = editor.getValue();
      if (!content.trim()) {
        throw new EmptyNoteError();
      }

      const enhancedSystemPrompt = `${this.context.systemPrompt}\nYou see the entire note context.`;
      const aiResponse = await this.callAI(content, enhancedSystemPrompt);
      
      await this.insertWholeNoteResponse(editor, aiResponse, label);
    } catch (error) {
      this.handleError(error);
    }
  }

  private ensureAIConfigured(): void {
    if (!this.context.apiKey) {
      throw new AINotConfiguredError();
    }
  }

  private async handleTargetLineDeepen(editor: Editor, line: number, text: string): Promise<void> {
    let buttonLine = this.findExistingButton(editor, line);
    
    if (buttonLine === null) {
      buttonLine = this.createNewButton(editor, line);
    }

    const aiResponse = await this.callAI(text);
    await this.insertTargetLineResponse(editor, buttonLine, aiResponse);
  }

  private async handleGeneralLineDeepen(editor: Editor, line: number, text: string): Promise<void> {
    const userHeader = `**${this.context.userName || 'You'}** (you): ${text}`;
    this.replaceLineWithHeader(editor, line, userHeader);

    const aiResponse = await this.callAI(text);
    await this.insertGeneralLineResponse(editor, line, aiResponse);
  }

  private findExistingButton(editor: Editor, line: number): number | null {
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

  private createNewButton(editor: Editor, line: number): number {
    ensureBottomButtons(editor, this.context.deepenButtonLabel);
    return editor.lastLine();
  }

  private replaceLineWithHeader(editor: Editor, line: number, header: string): void {
    const from = { line, ch: 0 };
    const to = { line, ch: editor.getLine(line).length };
    editor.replaceRange(header, from, to);
  }

  private async insertTargetLineResponse(editor: Editor, buttonLine: number, response: string): Promise<void> {
    editor.replaceRange('**Nova**: \n', { line: buttonLine, ch: 0 });
    await typewriterInsert(editor, buttonLine, '**Nova**: ', response, this.context.typewriterSpeed);
  }

  private async insertGeneralLineResponse(editor: Editor, line: number, response: string): Promise<void> {
    const anchorLine = this.findAnchorLine(editor, line);
    const scopeAttr = 'data-scope="note"';

    if (anchorLine !== null) {
      await this.insertAtExistingAnchor(editor, anchorLine, response, scopeAttr);
    } else {
      await this.insertAfterLine(editor, line, response, scopeAttr);
    }
  }

  private async insertWholeNoteResponse(editor: Editor, response: string, label: string): Promise<void> {
    const anchorLine = this.findNoteScopeAnchor(editor);
    this.prepareUserLine(editor, anchorLine);

    if (anchorLine !== null) {
      await this.insertAtExistingAnchor(editor, anchorLine, response, 'data-scope="note"', label);
    } else {
      await this.insertAtEndOfNote(editor, response, label);
    }
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
    const namePrefix = `**${this.context.userName || 'You'}** (you):`;
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
    
    await typewriterInsert(editor, anchorLine, '**Nova**: ', response, this.context.typewriterSpeed);
    removeAnchorsInBlock(editor, anchorLine);
    ensureBottomButtons(editor, label || this.context.deepenButtonLabel);
    ensureUserPromptLine(editor, this.context.userName);
  }

  private async insertAfterLine(editor: Editor, line: number, response: string, scopeAttr: string): Promise<void> {
    editor.replaceRange('**Nova**: \n', { line: line + 1, ch: 0 });
    await typewriterInsert(editor, line + 1, '**Nova**: ', response, this.context.typewriterSpeed);
    removeAnchorsInBlock(editor, line);
    ensureBottomButtons(editor, this.context.deepenButtonLabel);
    ensureUserPromptLine(editor, this.context.userName);
  }

  private async insertAtEndOfNote(editor: Editor, response: string, label: string): Promise<void> {
    const lastLine = editor.lastLine();
    const needsBreak = editor.getValue().trim().length > 0 ? '\n\n' : '';
    const insertPos = { line: lastLine, ch: editor.getLine(lastLine).length };
    
    editor.replaceRange(`${needsBreak}**Nova**: \n`, insertPos);
    const answerLine = editor.lastLine();
    
    await typewriterInsert(editor, answerLine, '**Nova**: ', response, this.context.typewriterSpeed);
    removeAnchorsInBlock(editor, answerLine);
    ensureBottomButtons(editor, label);
    ensureUserPromptLine(editor, this.context.userName);
  }

  private async callAI(userText: string, customSystemPrompt?: string): Promise<string> {
    try {
      return await chat({
        apiKey: this.context.apiKey,
        model: this.context.model,
        systemPrompt: customSystemPrompt || this.context.systemPrompt,
        userText,
        maxTokens: this.context.maxTokens,
        debug: this.context.debug,
        retryCount: this.context.retryCount,
        fallbackModel: this.context.fallbackModel,
      });
    } catch (error) {
      throw new AIServiceError('AI request failed', error);
    }
  }

  private handleError(error: unknown): void {
    console.error(error);
    
    if (error instanceof AINotConfiguredError ||
        error instanceof EmptyNoteError ||
        error instanceof NoTextToDeepenError) {
      new Notice(error.message);
    } else if (error instanceof AIServiceError) {
      new Notice('Nova Journal: AI request failed.');
    } else {
      new Notice('Nova Journal: An unexpected error occurred.');
    }
  }
}
