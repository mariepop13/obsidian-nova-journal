import { Editor } from 'obsidian';
import { TYPEWRITER_DELAYS } from '../shared/Constants';

type TypewriterSpeed = 'slow' | 'normal' | 'fast';

interface TypewriterConfig {
  editor: Editor;
  line: number;
  prefix: string;
  text: string;
  speed: TypewriterSpeed;
}

export class TypewriterService {
  private static readonly SENTENCE_ENDINGS = /[.!?]+/;
  private static readonly NEWLINES = /\n+/;
  private static readonly SPLIT_PATTERN = /([.!?]+|\n+)/;

  static async typewriterInsert(config: TypewriterConfig): Promise<void> {
    const tokens = this.tokenizeText(config.text);
    const delay = this.getDelayForSpeed(config.speed);
    
    await this.animateText(config.editor, config.line, config.prefix, tokens, delay);
    this.finalizeText(config.editor, config.line, config.prefix, tokens);
  }

  private static tokenizeText(text: string): string[] {
    return text
      .split(this.SPLIT_PATTERN)
      .reduce<string[]>((acc, part) => {
        if (!part) return acc;
        
        const lastToken = acc.length > 0 ? acc[acc.length - 1] : '';
        
        if (this.isNewline(part)) {
          acc.push(part);
        } else if (this.isSentenceEnding(part) && lastToken && !this.isNewline(lastToken)) {
          acc[acc.length - 1] = lastToken + part;
        } else {
          acc.push(part.trim());
        }
        
        return acc;
      }, [])
      .filter(token => token.length > 0);
  }

  private static getDelayForSpeed(speed: TypewriterSpeed): number {
    switch (speed) {
      case 'slow': return TYPEWRITER_DELAYS.SLOW;
      case 'fast': return TYPEWRITER_DELAYS.FAST;
      default: return TYPEWRITER_DELAYS.NORMAL;
    }
  }

  private static async animateText(
    editor: Editor, 
    line: number, 
    prefix: string, 
    tokens: string[], 
    delay: number
  ): Promise<void> {
    let current = prefix;
    const startTime = Date.now();

    for (let i = 0; i < tokens.length; i += 1) {
      if (this.shouldStopAnimation(editor, line, startTime)) break;

      const token = tokens[i];
      const separator = this.getSeparator(i, token, tokens[i - 1]);
      
      current += this.isNewline(token) ? token : separator + token;
      
      this.updateEditorLine(editor, line, current);
      await this.delay(delay);
    }
  }

  private static shouldStopAnimation(editor: Editor, line: number, startTime: number): boolean {
    return line > editor.lastLine() || 
           Date.now() - startTime > TYPEWRITER_DELAYS.MAX_DURATION_MS;
  }

  private static getSeparator(index: number, currentToken: string, previousToken?: string): string {
    if (index === 0) return '';
    if (currentToken === '\n') return '';
    if (previousToken && this.isNewline(previousToken)) return '';
    return ' ';
  }

  private static updateEditorLine(editor: Editor, line: number, content: string): void {
    editor.replaceRange(
      content,
      { line, ch: 0 },
      { line, ch: editor.getLine(line).length }
    );
  }

  private static finalizeText(editor: Editor, line: number, prefix: string, tokens: string[]): void {
    if (line <= editor.lastLine()) {
      const finalContent = this.buildFinalContent(prefix, tokens);
      this.updateEditorLine(editor, line, finalContent + '\n');
    }
  }

  private static buildFinalContent(prefix: string, tokens: string[]): string {
    let result = prefix;
    
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const separator = this.getSeparator(i, token, tokens[i - 1]);
      result += this.isNewline(token) ? token : separator + token;
    }
    
    return result;
  }

  private static isNewline(text: string): boolean {
    return this.NEWLINES.test(text);
  }

  private static isSentenceEnding(text: string): boolean {
    return this.SENTENCE_ENDINGS.test(text);
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
