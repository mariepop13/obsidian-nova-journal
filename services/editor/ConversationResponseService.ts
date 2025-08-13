import { Editor } from 'obsidian';
import { typewriterInsert, removeAnchorsInBlock, ensureBottomButtons, ensureUserPromptLine } from './NoteEditor';

interface ResponseInsertionConfig {
  editor: Editor;
  response: string;
  typewriterSpeed: 'slow' | 'normal' | 'fast';
  userName: string;
  deepenButtonLabel: string;
  buttonSettings?: any;
}

export class ConversationResponseService {
  private static readonly NOVA_PREFIX = '**Nova**: ';

  static async insertAtExistingAnchor(
    config: ResponseInsertionConfig,
    anchorLine: number,
    label?: string
  ): Promise<void> {
    this.replaceAnchorWithNovaHeader(config.editor, anchorLine);
    await this.insertResponseWithTypewriter(config, anchorLine);
    this.finalizeConversation(config, label);
  }

  static async insertAfterLine(
    config: ResponseInsertionConfig,
    line: number
  ): Promise<void> {
    this.insertNovaHeaderAfterLine(config.editor, line);
    await this.insertResponseWithTypewriter(config, line + 1);
    removeAnchorsInBlock(config.editor, line);
    this.finalizeConversation(config);
  }

  static async insertAtEndOfNote(
    config: ResponseInsertionConfig,
    label: string
  ): Promise<void> {
    const insertionLine = this.prepareEndOfNoteInsertion(config.editor);
    await this.insertResponseWithTypewriter(config, insertionLine);
    this.finalizeConversation(config, label);
  }

  private static replaceAnchorWithNovaHeader(editor: Editor, anchorLine: number): void {
    const lineLength = editor.getLine(anchorLine).length;
    editor.replaceRange(
      this.NOVA_PREFIX + '\n',
      { line: anchorLine, ch: 0 },
      { line: anchorLine, ch: lineLength }
    );
  }

  private static insertNovaHeaderAfterLine(editor: Editor, line: number): void {
    editor.replaceRange(this.NOVA_PREFIX + '\n', { line: line + 1, ch: 0 });
  }

  private static prepareEndOfNoteInsertion(editor: Editor): number {
    const lastLine = editor.lastLine();
    const needsBreak = editor.getValue().trim().length > 0 ? '\n\n' : '';
    const insertPos = { line: lastLine, ch: editor.getLine(lastLine).length };
    
    editor.replaceRange(`${needsBreak}${this.NOVA_PREFIX}\n`, insertPos);
    return editor.lastLine();
  }

  private static async insertResponseWithTypewriter(
    config: ResponseInsertionConfig,
    line: number
  ): Promise<void> {
    await typewriterInsert(
      config.editor,
      line,
      this.NOVA_PREFIX,
      config.response,
      config.typewriterSpeed
    );
  }

  private static finalizeConversation(
    config: ResponseInsertionConfig,
    label?: string
  ): void {
    const actualLabel = label || config.deepenButtonLabel;
    
    removeAnchorsInBlock(config.editor, config.editor.getCursor().line);
    ensureBottomButtons(config.editor, actualLabel, config.buttonSettings);
    ensureUserPromptLine(config.editor, config.userName);
  }
}
