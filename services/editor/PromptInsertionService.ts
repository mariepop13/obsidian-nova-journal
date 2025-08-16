import { Editor } from 'obsidian';
import { PromptService } from '../../prompt/PromptService';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { NovaJournalSettings, EnhancedInsertionLocation } from '../../settings/PluginSettings';
import { insertAtLocation, removeDateHeadingInEditor, ensureBottomButtons } from './NoteEditor';
import { PromptRenderingService, type RenderConfig } from '../rendering/PromptRenderingService';
import { FrontmatterService } from '../rendering/FrontmatterService';
import { PromptGenerationService } from '../ai/PromptGenerationService';
import { RagContextService } from '../ai/RagContextService';
import { ToastSpinnerService } from './ToastSpinnerService';

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

  private async insertPrompt(editor: Editor, location?: EnhancedInsertionLocation, duplicateMessage?: string): Promise<boolean> {
    try {
      removeDateHeadingInEditor(editor);
      
      const date = new Date();
      const mood = FrontmatterService.readMoodProps(editor);
      const contextAwareResult = await this.promptService.getContextAwarePrompt(
        this.settings.promptStyle as PromptStyle,
        date,
        editor.getValue(),
        mood
      );

      if (!contextAwareResult) {
        ToastSpinnerService.error('Nova Journal: failed to generate prompt.');
        return false;
      }

      const { style, prompt: fallbackPrompt } = contextAwareResult;

      let basePrompt = fallbackPrompt;
      let ragContext = '';
      
      if (this.ragContextService) {
        const editorContent = editor.getValue();
        const hasSubstantialContent = editorContent.trim().length > 50;
        
        if (hasSubstantialContent) {
          ragContext = await this.ragContextService.getRagContext(editorContent.trim(), editor);
        } else {
          ragContext = await this.ragContextService.getRecentContext(style);
        }
      }
      
      const generator = new PromptGenerationService(this.settings);
      const aiPrompt = await generator.generateOpeningPrompt(style, editor.getValue(), mood, ragContext);
      
      if (aiPrompt && aiPrompt.length > 0) {
        basePrompt = aiPrompt;
      } else {
        console.log('[PromptInsertionService] Debug - Using fallback prompt');
      }

      if (this.isDuplicatePrompt(editor, basePrompt)) {
        if (duplicateMessage) {
          ToastSpinnerService.info(duplicateMessage);
        }
        return false;
      }

      const prompt = this.renderPrompt(basePrompt, date);
      const insertLocation = location || this.settings.insertLocation;
      
      insertAtLocation(editor, prompt, insertLocation, this.settings.insertHeadingName);
      ensureBottomButtons(editor, this.settings.deepenButtonLabel, this.createButtonSettings());
      ToastSpinnerService.notice('Nova Journal: prompt inserted.');
      return true;
    } catch (error) {
      console.error('Nova Journal: prompt insertion error', error);
      ToastSpinnerService.error('Nova Journal: failed to insert prompt. See console for details.');
      return false;
    }
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
      aiEnabled: this.settings.aiEnabled
    };
    return PromptRenderingService.renderFinalPrompt(config);
  }

  private createButtonSettings(): any {
    return {
      buttonStyle: this.settings.buttonStyle,
      buttonPosition: this.settings.buttonPosition,
      moodButtonLabel: this.settings.moodButtonLabel,
      showMoodButton: this.settings.showMoodButton,
      buttonTheme: this.settings.buttonTheme,
      deepenButtonLabel: this.settings.deepenButtonLabel
    };
  }

  private generateSearchTermsForStyle(style: PromptStyle): string {
    return `${style} personal experience thoughts feelings`;
  }
}