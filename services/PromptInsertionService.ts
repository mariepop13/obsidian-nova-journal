import { Editor, Notice, App } from 'obsidian';
import { PromptService } from '../prompt/PromptService';
import type { PromptStyle } from '../prompt/PromptRegistry';
import type { NovaJournalSettings, EnhancedInsertionLocation } from '../settings/PluginSettings';
import { insertAtLocation, removeDateHeadingInEditor } from './NoteEditor';
import { PromptRenderingService } from './PromptRenderingService';
import { MoodTrackingService, type MoodData } from './MoodTrackingService';
import { MoodSelectionModal } from '../ui/MoodSelectionModal';

export class PromptInsertionService {
  private readonly moodTrackingService: MoodTrackingService;

  constructor(
    private readonly promptService: PromptService,
    private readonly settings: NovaJournalSettings,
    private readonly app: App
  ) {
    this.moodTrackingService = new MoodTrackingService(settings);
  }

  async insertPromptAtLocation(editor: Editor, location?: EnhancedInsertionLocation): Promise<void> {
    removeDateHeadingInEditor(editor);
    
    const date = new Date();
    const basePrompt = this.promptService.getPromptForDate(this.settings.promptStyle as PromptStyle, date);
    
    if (this.isDuplicatePrompt(editor, basePrompt)) {
      new Notice('Nova Journal: this prompt already exists in this note.');
      return;
    }
    
    const prompt = this.renderPrompt(basePrompt, date);
    const insertLocation = location || this.settings.insertLocation;
    
    insertAtLocation(editor, prompt, insertLocation, this.settings.insertHeadingName);
    new Notice('Nova Journal: prompt inserted.');
  }

    async insertTodaysPromptWithDuplicateCheck(
    editor: Editor, 
    basePrompt: string, 
    date: Date,
    currentFile?: any
  ): Promise<boolean> {
    if (this.settings.preventDuplicateForDay) {
      const noteText = editor.getValue();
      const hasDuplicate = PromptRenderingService.checkForDuplicatePrompt(
        noteText, 
        basePrompt, 
        date, 
        this.settings.useDuplicateMarker !== false
      );
      
      if (hasDuplicate) {
        new Notice('Nova Journal: prompt for today already exists in this note.');
        return false;
      }
    }

    // Handle mood tracking if enabled
    if (this.moodTrackingService.isEnabled()) {
      return new Promise((resolve) => {
        const modal = new MoodSelectionModal(
          this.app,
          this.settings,
          async (moodData: MoodData) => {
            const success = await this.insertPromptWithoutMood(editor, basePrompt, date);
            
            if (success && currentFile) {
              try {
                await this.moodTrackingService.addMoodToFile(currentFile, this.app.vault, moodData);
              } catch (error) {
                console.error('Failed to add mood data:', error);
                new Notice('Failed to save mood data, but prompt was inserted.');
              }
            }
            
            resolve(success);
          },
          () => {
            if (this.moodTrackingService.isRequired()) {
              new Notice('Mood selection is required.');
              resolve(false);
            } else {
              this.insertPromptWithoutMood(editor, basePrompt, date).then(resolve);
            }
          }
        );
        modal.open();
      });
    }

    return this.insertPromptWithoutMood(editor, basePrompt, date);
  }

  private async insertPromptWithoutMood(
    editor: Editor,
    basePrompt: string,
    date: Date
  ): Promise<boolean> {
    const prompt = this.renderPrompt(basePrompt, date);
    insertAtLocation(editor, prompt, this.settings.insertLocation, this.settings.insertHeadingName);
    
    if (this.settings.useDuplicateMarker !== false) {
      this.addDuplicateMarker(editor, date);
    }
    
    return true;
  }

  private isDuplicatePrompt(editor: Editor, basePrompt: string): boolean {
    return this.settings.preventDuplicateForDay && editor.getValue().includes(basePrompt);
  }

  private renderPrompt(basePrompt: string, date: Date): string {
    return PromptRenderingService.renderFinalPrompt(
      basePrompt,
      date,
      this.settings.addSectionHeading,
      this.settings.sectionHeading,
      this.settings.promptTemplate,
      this.settings.userName,
      this.settings.aiEnabled
    );
  }

  private addDuplicateMarker(editor: Editor, date: Date): void {
    const marker = PromptRenderingService.generateDuplicateMarker(date);
    const lastLine = editor.lastLine();
    const insertPos = { line: lastLine, ch: editor.getLine(lastLine).length };
    editor.replaceRange(marker, insertPos);
  }
}
