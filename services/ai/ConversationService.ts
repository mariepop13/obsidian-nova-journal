import { Editor } from 'obsidian';
import { chat } from '../../ai/AiClient';
import type { ButtonPosition, ButtonStyle, NovaJournalSettings } from '../../settings/PluginSettings';
import { getDeepenSource } from '../editor/NoteEditor';
import { AINotConfiguredError, AIServiceError, EmptyNoteError, NoTextToDeepenError } from '../shared/ErrorTypes';
import { RagContextService } from './RagContextService';
import { ResponseInsertionService } from './ResponseInsertionService';
import { ToastSpinnerService } from '../editor/ToastSpinnerService';

export interface ButtonSettings {
  buttonStyle?: ButtonStyle;
  buttonPosition?: ButtonPosition;
  moodButtonLabel?: string;
  showMoodButton?: boolean;
  buttonTheme?: string;
  deepenButtonLabel?: string;
}

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
  buttonSettings: ButtonSettings;
}

export class ConversationService {
  private readonly context: ConversationContext;
  private readonly settings: NovaJournalSettings;
  private readonly ragContextService: RagContextService;
  private readonly responseInsertionService: ResponseInsertionService;

  constructor(settings: NovaJournalSettings) {
    this.settings = settings;
    this.context = this.createConversationContext(settings);
    this.ragContextService = new RagContextService(settings);
    this.responseInsertionService = this.createResponseInsertionService(settings);
  }

  private createConversationContext(settings: NovaJournalSettings): ConversationContext {
    return {
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
      buttonSettings: this.createButtonSettings(settings),
    };
  }

  private createButtonSettings(settings: NovaJournalSettings): ButtonSettings {
    return {
      buttonStyle: settings.buttonStyle,
      buttonPosition: settings.buttonPosition,
      moodButtonLabel: settings.moodButtonLabel,
      showMoodButton: settings.showMoodButton,
      buttonTheme: settings.buttonTheme,
      deepenButtonLabel: settings.deepenButtonLabel,
    };
  }

  private createResponseInsertionService(settings: NovaJournalSettings): ResponseInsertionService {
    return new ResponseInsertionService(
      settings.userName,
      settings.deepenButtonLabel,
      settings.typewriterSpeed,
      this.context.buttonSettings
    );
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
      const aiResponse = await this.callAI(content, { customSystemPrompt: enhancedSystemPrompt, editor });

      await this.responseInsertionService.insertWholeNoteResponse(editor, aiResponse, label);
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
    let buttonLine = this.responseInsertionService.findExistingButton(editor, line);

    buttonLine ??= this.responseInsertionService.createNewButton(editor);

    const aiResponse = await this.callAI(text, { editor, targetLine: line });
    await this.responseInsertionService.insertTargetLineResponse(editor, buttonLine, aiResponse);
  }

  private async handleGeneralLineDeepen(editor: Editor, line: number, text: string): Promise<void> {
    const userHeader = `**${this.context.userName ?? 'You'}** (you): ${text}`;
    this.replaceLineWithHeader(editor, line, userHeader);

    const aiResponse = await this.callAI(text, { editor });
    await this.responseInsertionService.insertGeneralLineResponse(editor, line, aiResponse);
  }

  private replaceLineWithHeader(editor: Editor, line: number, header: string): void {
    const from = { line, ch: 0 };
    const to = { line, ch: editor.getLine(line).length };
    editor.replaceRange(header, from, to);
  }

  private createRagEnhancedSystemPrompt(): string {
    return `You are Nova, a journaling assistant. You have access to context from the user's previous journal entries.

MANDATORY RESPONSE FORMAT: You must begin your response by explicitly referencing the context provided. Start by acknowledging the specific situation, timeframe, emotion, and reason from the context.

Then continue with ONE reflective question or insight. Keep your response concise (2-3 sentences total). DO NOT repeat questions or add multiple versions of the same question.

DO NOT give vague responses. DO NOT say things like "after the betrayal you felt" without specifying what exactly happened according to the context.

You must demonstrate you read and understood the specific context by mentioning:
- Specific people mentioned
- Specific events that occurred  
- Specific timeframes provided
- Specific reasons emotions were felt
- Specific circumstances described

Respond in the same language as the user's current entry.`;
  }

  private createRagEnhancedUserText(userText: string, ragContext: string): string {
    return `Current entry: ${userText}

CONTEXT YOU MUST REFERENCE:
${ragContext}

Respond by first acknowledging the specific context above, then continue with your insight.`;
  }

  private async callAI(
    userText: string,
    options: {
      customSystemPrompt?: string;
      editor?: Editor;
      targetLine?: number;
    } = {}
  ): Promise<string> {
    const toast = ToastSpinnerService.showThinking('Thinking...');

    try {
      const ragContext = await this.ragContextService.getRagContext(userText, options.editor, options.targetLine);
      
      toast.updateState('generating');
      toast.updateMessage('Generating response...');

      const { enhancedSystemPrompt, enhancedUserText, maxTokens } = this.prepareAIRequest(userText, ragContext, options);

      const response = await this.makeAIRequest(enhancedSystemPrompt, enhancedUserText, maxTokens);

      toast.hide();
      return response;
    } catch (error) {
      toast.hide();
      throw new AIServiceError('AI request failed', error);
    }
  }

  private prepareAIRequest(
    userText: string, 
    ragContext: string | null, 
    options: { customSystemPrompt?: string }
  ) {
    const enhancedSystemPrompt = ragContext 
      ? this.createRagEnhancedSystemPrompt()
      : options.customSystemPrompt ?? this.context.systemPrompt;
    
    const enhancedUserText = ragContext
      ? this.createRagEnhancedUserText(userText, ragContext)
      : userText;

    const maxTokens = ragContext ? Math.min(120, this.context.maxTokens) : this.context.maxTokens;

    return { enhancedSystemPrompt, enhancedUserText, maxTokens };
  }

  private async makeAIRequest(systemPrompt: string, userText: string, maxTokens: number): Promise<string> {
    return await chat({
      apiKey: this.context.apiKey,
      model: this.context.model,
      systemPrompt,
      userText,
      maxTokens,
      debug: this.context.debug,
      retryCount: this.context.retryCount,
      fallbackModel: this.context.fallbackModel,
    });
  }

  private handleError(error: unknown): void {
    if (
      error instanceof AINotConfiguredError ||
      error instanceof EmptyNoteError ||
      error instanceof NoTextToDeepenError
    ) {
      ToastSpinnerService.error(error.message);
    } else if (error instanceof AIServiceError) {
      ToastSpinnerService.error('Nova Journal: AI request failed.');
    } else {
      ToastSpinnerService.error('Nova Journal: An unexpected error occurred.');
    }
  }
}
