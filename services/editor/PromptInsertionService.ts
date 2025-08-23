import { Editor } from 'obsidian';
import { PromptService } from '../../prompt/PromptService';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { EnhancedInsertionLocation, NovaJournalSettings, ButtonStyle, ButtonPosition } from '../../settings/PluginSettings';
import { ensureBottomButtons, insertAtLocation, removeDateHeadingInEditor } from './NoteEditor';
import { PromptRenderingService, type RenderConfig } from '../rendering/PromptRenderingService';
import { FrontmatterService, type MoodData } from '../rendering/FrontmatterService';
import { PromptGenerationService } from '../ai/PromptGenerationService';
import { RagContextService } from '../ai/RagContextService';
import { ToastSpinnerService } from './ToastSpinnerService';

interface ButtonSettings {
  buttonStyle?: ButtonStyle;
  buttonPosition?: ButtonPosition;
  moodButtonLabel?: string;
  showMoodButton?: boolean;
  buttonTheme?: string;
  deepenButtonLabel?: string;
}

interface ContextData {
  style: PromptStyle;
  prompt: string;
  mood?: Partial<MoodData> | null;
  date: Date;
}


import { CONTENT_LIMITS } from '../shared/Constants';

export class PromptInsertionService {
  constructor(
    private readonly promptService: PromptService,
    private readonly settings: NovaJournalSettings,
    private readonly ragContextService?: RagContextService
  ) {}

  async insertPromptAtLocation(editor: Editor, location?: EnhancedInsertionLocation): Promise<void> {
    await this.insertPrompt(editor, location, 'Nova Journal: this prompt already exists in this note.');
  }

  async insertTodaysPrompt(editor: Editor): Promise<boolean> {
    return await this.insertPrompt(editor, undefined, 'Nova Journal: prompt for today already exists in this note.');
  }

  private async insertPrompt(
    editor: Editor,
    location?: EnhancedInsertionLocation,
    duplicateMessage?: string
  ): Promise<boolean> {
    try {
      removeDateHeadingInEditor(editor);
      
      const contextData = await this.preparePromptContext(editor);
      if (!contextData) return false;

      const basePrompt = await this.generatePromptWithContext(editor, contextData);
      if (this.isDuplicatePrompt(editor, basePrompt)) {
        return this.handleDuplicatePrompt(duplicateMessage);
      }

      return this.performPromptInsertion(editor, basePrompt, contextData.date, location);
    } catch (_error) {
      ToastSpinnerService.error('Nova Journal: failed to insert prompt. See console for details.');
      return false;
    }
  }

  private async preparePromptContext(editor: Editor): Promise<ContextData | null> {
    const date = new Date();
    const mood = FrontmatterService.readMoodProps(editor);
    const contextAwareResult = await this.promptService.getContextAwarePrompt({
      preferredStyle: this.settings.promptStyle as PromptStyle,
      date,
      noteText: editor.getValue(),
      moodData: mood,
    });

    if (!contextAwareResult) {
      ToastSpinnerService.error('Nova Journal: failed to generate prompt.');
      return null;
    }

    return { ...contextAwareResult, date, mood: mood || null };
  }

  private async generatePromptWithContext(editor: Editor, contextData: ContextData): Promise<string> {
    const { style, prompt: fallbackPrompt, mood } = contextData;
    
    const ragContext = await this.retrieveRagContext(editor, style);
    const generator = new PromptGenerationService(this.settings);
    const aiPrompt = await generator.generateOpeningPrompt(style, editor.getValue(), mood || undefined, ragContext);

    if (aiPrompt && aiPrompt.length > 0) {
      return aiPrompt;
    } 

      return fallbackPrompt;
    
  }

  private async retrieveRagContext(editor: Editor, style: PromptStyle): Promise<string> {
    if (!this.ragContextService) return '';

    try {
      const editorContent = editor.getValue();
      const trimmedContent = editorContent.trim().slice(0, CONTENT_LIMITS.TRIMMED_CONTENT_MAX);
      const hasSubstantialContent = trimmedContent.length > CONTENT_LIMITS.MIN_CONTENT_LENGTH;

      const ragPromise = hasSubstantialContent
        ? this.ragContextService.getRagContext(trimmedContent, editor)
        : this.ragContextService.getRecentContext(style);

      return await Promise.race([ragPromise, new Promise<string>(res => setTimeout(() => res(''), 2000))]);
    } catch (_err) {
      return '';
    }
  }

  private handleDuplicatePrompt(duplicateMessage?: string): boolean {
    if (duplicateMessage) {
      ToastSpinnerService.info(duplicateMessage);
    }
    return false;
  }

  private performPromptInsertion(editor: Editor, basePrompt: string, date: Date, location?: EnhancedInsertionLocation): boolean {
    const prompt = this.renderPrompt(basePrompt, date);
    const insertLocation = location ?? this.settings.insertLocation;

    insertAtLocation(editor, prompt, insertLocation, this.settings.insertHeadingName);
    ensureBottomButtons(editor, this.settings.deepenButtonLabel, this.createButtonSettings());
    ToastSpinnerService.notice('Nova Journal: prompt inserted.');
    return true;
  }

  private isDuplicatePrompt(editor: Editor, basePrompt: string): boolean {
    return this.settings.preventDuplicateForDay && editor.getValue().includes(basePrompt);
  }

  private renderPrompt(basePrompt: string, date: Date): string {
    const config: RenderConfig = {
      basePrompt,
      date,
      addSectionHeading: this.settings.addSectionHeading,
      sectionHeading: this.settings.sectionHeading,
      promptTemplate: this.settings.promptTemplate,
      userName: this.settings.userName,
      aiEnabled: this.settings.aiEnabled,
    };
    return PromptRenderingService.renderFinalPrompt(config);
  }

  private createButtonSettings(): ButtonSettings {
    return {
      buttonStyle: this.settings.buttonStyle,
      buttonPosition: this.settings.buttonPosition,
      moodButtonLabel: this.settings.moodButtonLabel,
      showMoodButton: this.settings.showMoodButton,
      buttonTheme: this.settings.buttonTheme,
      deepenButtonLabel: this.settings.deepenButtonLabel,
    };
  }

}
