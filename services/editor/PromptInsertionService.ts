import { Editor, Notice } from 'obsidian';
import { PromptService } from '../../prompt/PromptService';
import type { PromptStyle } from '../../prompt/PromptRegistry';
import type { NovaJournalSettings, EnhancedInsertionLocation } from '../../settings/PluginSettings';
import { insertAtLocation, removeDateHeadingInEditor, ensureBottomButtons } from './NoteEditor';
import { PromptRenderingService, type RenderConfig } from '../rendering/PromptRenderingService';

export class PromptInsertionService {
  constructor(
    private readonly promptService: PromptService,
    private readonly settings: NovaJournalSettings
  ) {}

  async insertPromptAtLocation(editor: Editor, location?: EnhancedInsertionLocation): Promise<void> {
    removeDateHeadingInEditor(editor);
    
    const date = new Date();
    const { prompt: basePrompt } = this.promptService.getContextAwarePrompt(
      this.settings.promptStyle as PromptStyle,
      date,
      editor.getValue()
    );

    if (this.isDuplicatePrompt(editor, basePrompt)) {
      new Notice('Nova Journal: this prompt already exists in this note.');
      return;
    }

    const prompt = this.renderPrompt(basePrompt, date);
    const insertLocation = location || this.settings.insertLocation;
    
    insertAtLocation(editor, prompt, insertLocation, this.settings.insertHeadingName);
    ensureBottomButtons(editor, this.settings.deepenButtonLabel, this.createButtonSettings());
    new Notice('Nova Journal: prompt inserted.');
  }

  async insertTodaysPromptWithDuplicateCheck(
    editor: Editor, 
    basePrompt: string, 
    date: Date
  ): Promise<boolean> {
    if (this.isDuplicatePrompt(editor, basePrompt)) {
      new Notice('Nova Journal: prompt for today already exists in this note.');
      return false;
    }

    const prompt = this.renderPrompt(basePrompt, date);
    insertAtLocation(editor, prompt, this.settings.insertLocation, this.settings.insertHeadingName);
    ensureBottomButtons(editor, this.settings.deepenButtonLabel, this.createButtonSettings());
    
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
}