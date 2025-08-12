import { Editor, Notice } from 'obsidian';
import { PromptService } from '../prompt/PromptService';
import type { PromptStyle } from '../prompt/PromptRegistry';
import type { NovaJournalSettings, EnhancedInsertionLocation } from '../settings/PluginSettings';
import { insertAtLocation, removeDateHeadingInEditor } from './NoteEditor';
import { PromptRenderingService } from './PromptRenderingService';

export class PromptInsertionService {
  constructor(
    private readonly promptService: PromptService,
    private readonly settings: NovaJournalSettings
  ) {}

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
    date: Date
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