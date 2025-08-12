import { Modal, App, Setting, ButtonComponent } from 'obsidian';
import type { MoodData } from '../services/MoodTrackingService';
import type { NovaJournalSettings } from '../settings/PluginSettings';

export class MoodSelectionModal extends Modal {
  private readonly settings: NovaJournalSettings;
  private moodData: MoodData = {};
  private onSubmit: (data: MoodData) => void;
  private onCancel: () => void;

  constructor(
    app: App, 
    settings: NovaJournalSettings,
    onSubmit: (data: MoodData) => void,
    onCancel: () => void
  ) {
    super(app);
    this.settings = settings;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'How are you feeling?' });

    this.renderMoodSelector(contentEl);
    
    if (this.settings.energyTrackingEnabled) {
      this.renderEnergySelector(contentEl);
    }

    this.renderTagSelector(contentEl);
    this.renderButtons(contentEl);
  }

  private renderMoodSelector(containerEl: HTMLElement): void {
    const moodContainer = containerEl.createDiv('mood-selector');
    moodContainer.createEl('h3', { text: 'Mood' });

    const emojiContainer = moodContainer.createDiv('emoji-grid');
    emojiContainer.style.display = 'grid';
    emojiContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
    emojiContainer.style.gap = '10px';
    emojiContainer.style.marginBottom = '20px';

    this.settings.moodDefaultEmojis.forEach((emoji, index) => {
      const button = emojiContainer.createEl('button', {
        text: emoji,
        cls: 'mood-emoji-button'
      });
      
      button.style.fontSize = '2em';
      button.style.padding = '10px';
      button.style.border = '2px solid transparent';
      button.style.borderRadius = '8px';
      button.style.cursor = 'pointer';
      button.style.background = 'var(--background-secondary)';

      button.addEventListener('click', () => {
        // Remove selection from other buttons
        emojiContainer.querySelectorAll('.mood-emoji-button').forEach(btn => {
          (btn as HTMLElement).style.border = '2px solid transparent';
        });
        
        // Select this button
        button.style.border = '2px solid var(--interactive-accent)';
        this.moodData.mood = emoji;
        this.moodData.moodLevel = index + 1; // 1-5 scale based on emoji position
      });
    });

    if (this.settings.moodPromptRequired) {
      const requiredNote = moodContainer.createEl('p', {
        text: '* Mood selection is required',
        cls: 'mood-required-note'
      });
      requiredNote.style.color = 'var(--text-error)';
      requiredNote.style.fontSize = '0.9em';
      requiredNote.style.fontStyle = 'italic';
    }
  }

  private renderEnergySelector(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Energy level')
      .setDesc('How energetic do you feel? (1-10)')
      .addSlider(slider => {
        slider.setLimits(1, 10, 1);
        slider.setValue(5);
        slider.setDynamicTooltip();
        slider.onChange(value => {
          this.moodData.energy = value;
        });
      });
  }

  private renderTagSelector(containerEl: HTMLElement): void {
    if (this.settings.customMoodTags.length === 0) return;

    const tagContainer = containerEl.createDiv('tag-selector');
    tagContainer.createEl('h3', { text: 'Tags (optional)' });

    const tagsGrid = tagContainer.createDiv('tags-grid');
    tagsGrid.style.display = 'flex';
    tagsGrid.style.flexWrap = 'wrap';
    tagsGrid.style.gap = '8px';
    tagsGrid.style.marginBottom = '20px';

    this.moodData.tags = [];

    this.settings.customMoodTags.forEach(tag => {
      const tagButton = tagsGrid.createEl('button', {
        text: tag,
        cls: 'mood-tag-button'
      });

      tagButton.style.padding = '6px 12px';
      tagButton.style.border = '1px solid var(--background-modifier-border)';
      tagButton.style.borderRadius = '16px';
      tagButton.style.background = 'var(--background-secondary)';
      tagButton.style.cursor = 'pointer';
      tagButton.style.fontSize = '0.9em';

      tagButton.addEventListener('click', () => {
        const isSelected = tagButton.style.background === 'var(--interactive-accent)';
        
        if (isSelected) {
          // Deselect
          tagButton.style.background = 'var(--background-secondary)';
          tagButton.style.color = 'var(--text-normal)';
          this.moodData.tags = this.moodData.tags?.filter(t => t !== tag) || [];
        } else {
          // Select
          tagButton.style.background = 'var(--interactive-accent)';
          tagButton.style.color = 'var(--text-on-accent)';
          this.moodData.tags = [...(this.moodData.tags || []), tag];
        }
      });
    });
  }

  private renderButtons(containerEl: HTMLElement): void {
    const buttonContainer = containerEl.createDiv('button-container');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '20px';

    new ButtonComponent(buttonContainer)
      .setButtonText('Cancel')
      .onClick(() => {
        this.close();
        this.onCancel();
      });

    new ButtonComponent(buttonContainer)
      .setButtonText('Save')
      .setCta()
      .onClick(() => {
        if (this.settings.moodPromptRequired && !this.moodData.mood) {
          // Show error - could be enhanced with a notice
          return;
        }
        
        this.close();
        this.onSubmit(this.moodData);
      });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
