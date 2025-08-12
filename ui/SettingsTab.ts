import { App, PluginSettingTab, Setting, TextComponent, DropdownComponent, ToggleComponent, TextAreaComponent } from 'obsidian';
import type NovaJournalPlugin from '../main';

export class NovaJournalSettingTab extends PluginSettingTab {
  private readonly plugin: NovaJournalPlugin;

  constructor(app: App, plugin: NovaJournalPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Nova Journal Settings' });

    new Setting(containerEl)
      .setName('Prompt style')
      .setDesc('Select the style of prompt to insert for today.')
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown.addOptions({ reflective: 'Reflective', gratitude: 'Gratitude', planning: 'Planning' });
        dropdown.setValue(this.plugin.settings.promptStyle);
        dropdown.onChange(async (value) => {
          this.plugin.settings.promptStyle = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Insert location')
      .setDesc('Where to insert the prompt in the daily note.')
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown.addOptions({ cursor: 'Cursor', top: 'Top', bottom: 'Bottom' });
        dropdown.setValue(this.plugin.settings.insertLocation);
        dropdown.onChange(async (value) => {
          this.plugin.settings.insertLocation = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Add section heading')
      .setDesc('Insert a heading above the prompt (e.g., "## Prompt").')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.addSectionHeading);
        toggle.onChange(async (value) => {
          this.plugin.settings.addSectionHeading = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName('Add date heading at top of note')
      .setDesc('Insert a date heading as first line of the daily note.')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.addDateHeading);
        toggle.onChange(async (value) => {
          this.plugin.settings.addDateHeading = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Prevent duplicate prompt for today')
      .setDesc('If enabled, the command will not insert a second prompt for the same date in this note.')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.preventDuplicateForDay);
        toggle.onChange(async (value) => {
          this.plugin.settings.preventDuplicateForDay = value;
          await this.plugin.saveSettings();
        });
      });

    if (this.plugin.settings.addSectionHeading) {
      new Setting(containerEl)
        .setName('Section heading text')
        .addText((text: TextComponent) => {
          text.setPlaceholder('## Prompt')
            .setValue(this.plugin.settings.sectionHeading)
            .onChange(async (value) => {
              this.plugin.settings.sectionHeading = value;
              await this.plugin.saveSettings();
            });
        });
    }

    new Setting(containerEl)
      .setName('Daily note folder')
      .setDesc('Folder path for daily notes (auto-created if missing).')
      .addText((text: TextComponent) => {
        text.setPlaceholder('Journal')
          .setValue(this.plugin.settings.dailyNoteFolder)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteFolder = value || 'Journal';
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Daily note file format')
      .setDesc('Filename format (limited support): e.g., YYYY-MM-DD')
      .addText((text: TextComponent) => {
        text.setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.dailyNoteFormat)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteFormat = value || 'YYYY-MM-DD';
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Prompt template (optional)')
      .setDesc('Use variables like {{prompt}}, {{date}} or {{date:YYYY-MM-DD}}')
      .addTextArea((ta: TextAreaComponent) => {
        ta.setPlaceholder('{{prompt}}')
          .setValue(this.plugin.settings.promptTemplate || '')
          .onChange(async (value) => {
            this.plugin.settings.promptTemplate = value;
            await this.plugin.saveSettings();
          });
        ta.inputEl.cols = 40;
        ta.inputEl.rows = 4;
      });

    containerEl.createEl('h3', { text: 'AI (optional)' });

    new Setting(containerEl)
      .setName('Enable AI')
      .addToggle(t => t.setValue(this.plugin.settings.aiEnabled).onChange(async (v) => {
        this.plugin.settings.aiEnabled = v;
        await this.plugin.saveSettings();
        this.display();
      }));

    if (this.plugin.settings.aiEnabled) {
      new Setting(containerEl)
        .setName('API Key')
        .setDesc('Stored locally in plugin settings')
        .addText(t => t.setPlaceholder('sk-...')
          .setValue(this.plugin.settings.aiApiKey)
          .onChange(async (v) => {
            this.plugin.settings.aiApiKey = v;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Model')
        .addText(t => t.setPlaceholder('gpt-5-mini')
          .setValue(this.plugin.settings.aiModel)
          .onChange(async (v) => {
            this.plugin.settings.aiModel = v || 'gpt-5-mini';
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('System prompt')
        .addTextArea((ta: TextAreaComponent) => {
          ta.setValue(this.plugin.settings.aiSystemPrompt)
            .onChange(async (v) => {
              this.plugin.settings.aiSystemPrompt = v;
              await this.plugin.saveSettings();
            });
          ta.inputEl.rows = 3;
        });

      new Setting(containerEl)
        .setName('Deepen button label')
        .setDesc('Shown under your last line, e.g., “Explore more”')
        .addText(t => t.setValue(this.plugin.settings.deepenButtonLabel)
          .onChange(async (v) => {
            this.plugin.settings.deepenButtonLabel = v || 'Explore more';
            await this.plugin.saveSettings();
          }));
    }
  }
}


