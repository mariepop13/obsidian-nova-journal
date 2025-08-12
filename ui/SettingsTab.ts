import { App, PluginSettingTab, Setting, TextComponent, DropdownComponent, ToggleComponent, TextAreaComponent } from 'obsidian';
import { DEFAULT_SETTINGS } from '../settings/PluginSettings';
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
      .setName('Reset to defaults')
      .setDesc('Restore all Nova Journal settings to factory defaults')
      .addButton(b => b.setButtonText('Reset').onClick(async () => {
        this.plugin.settings = { ...DEFAULT_SETTINGS } as any;
        await this.plugin.saveSettings();
        this.display();
      }));

    new Setting(containerEl)
      .setName('Daily prompt style')
      .setDesc('Select the style of the daily prompt.')
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown.addOptions({ reflective: 'Reflective', gratitude: 'Gratitude', planning: 'Planning' });
        dropdown.setValue(this.plugin.settings.promptStyle);
        dropdown.onChange(async (value) => {
          this.plugin.settings.promptStyle = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Insert at')
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

    // Removed deprecated "Add date heading at top of note"

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
        .setName('Section heading')
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
      .setDesc('Filename format for daily notes')
      .addDropdown((dropdown: DropdownComponent) => {
        dropdown.addOptions({ 'YYYY-MM-DD': 'YYYY-MM-DD', 'YYYY-MM-DD_HH-mm': 'YYYY-MM-DD_HH-mm' });
        dropdown.setValue(this.plugin.settings.dailyNoteFormat);
        dropdown.onChange(async (value) => {
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

    containerEl.createEl('h3', { text: 'AI (OpenAI only, optional)' });

    new Setting(containerEl)
      .setName('Enable AI')
      .addToggle(t => t.setValue(this.plugin.settings.aiEnabled).onChange(async (v) => {
        this.plugin.settings.aiEnabled = v;
        await this.plugin.saveSettings();
        this.display();
      }));

    if (this.plugin.settings.aiEnabled) {
      new Setting(containerEl)
        .setName('OpenAI API Key')
        .setDesc('Stored locally. Only OpenAI is supported for now.')
        .addText(t => t.setPlaceholder('sk-...')
          .setValue(this.plugin.settings.aiApiKey)
          .onChange(async (v) => {
            this.plugin.settings.aiApiKey = v;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('OpenAI model')
        .setDesc('e.g., gpt-5-mini. Only OpenAI models are supported for now.')
        .addText(t => t.setPlaceholder('gpt-5-mini')
          .setValue(this.plugin.settings.aiModel)
          .onChange(async (v) => {
            this.plugin.settings.aiModel = v || 'gpt-5-mini';
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Fallback OpenAI model')
        .setDesc('Optional. Used if the primary OpenAI model fails.')
        .addText(t => t.setPlaceholder('gpt-4o-mini')
          .setValue(this.plugin.settings.aiFallbackModel || '')
          .onChange(async (v) => {
            this.plugin.settings.aiFallbackModel = v || '';
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
        .setName('Explore link label')
        .setDesc('Shown under your last line, e.g., “Explore more”')
        .addText(t => t.setValue(this.plugin.settings.deepenButtonLabel)
          .onChange(async (v) => {
            this.plugin.settings.deepenButtonLabel = v || 'Explore more';
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Your display name')
        .setDesc('Used in conversation blocks (e.g., “Name (you): …”)')
        .addText(t => t.setValue(this.plugin.settings.userName)
          .onChange(async (v) => {
            this.plugin.settings.userName = v || 'You';
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('AI debug logs')
        .setDesc('Print request/response status to console')
        .addToggle(t => t.setValue(this.plugin.settings.aiDebug)
          .onChange(async (v) => {
            this.plugin.settings.aiDebug = v;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Max tokens')
        .setDesc('Upper bound on AI response tokens')
        .addText(t => t.setPlaceholder('256')
          .setValue(String(this.plugin.settings.aiMaxTokens))
          .onChange(async (v) => {
            const n = Number(v);
            this.plugin.settings.aiMaxTokens = Number.isFinite(n) && n > 0 ? n : 256;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Retry count')
        .setDesc('Number of retries on transient AI errors')
        .addText(t => t.setPlaceholder('2')
          .setValue(String(this.plugin.settings.aiRetryCount))
          .onChange(async (v) => {
            const n = Number(v);
            this.plugin.settings.aiRetryCount = Number.isFinite(n) && n >= 0 ? n : 2;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Default deepen scope')
        .setDesc('What Explore more targets by default')
        .addDropdown(d => {
          d.addOptions({ line: 'Current line', note: 'Whole note' });
          d.setValue(this.plugin.settings.defaultDeepenScope);
          d.onChange(async (v) => {
            this.plugin.settings.defaultDeepenScope = (v as any) || 'line';
            await this.plugin.saveSettings();
          });
        });
    }
  }
}


