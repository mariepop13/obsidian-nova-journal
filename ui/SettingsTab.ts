import { App, PluginSettingTab, Setting, TextComponent, DropdownComponent, ToggleComponent, TextAreaComponent, Notice } from 'obsidian';
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
        dropdown.addOptions({ cursor: 'Cursor', top: 'Top', bottom: 'Bottom', 'below-heading': 'Below heading' });
        dropdown.setValue(this.plugin.settings.insertLocation as any);
        dropdown.onChange(async (value) => {
          this.plugin.settings.insertLocation = value as any;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if ((this.plugin.settings.insertLocation as any) === 'below-heading') {
      new Setting(containerEl)
        .setName('Heading name')
        .setDesc('Insert right below this heading (exact text). If empty, inserts below the first heading.')
        .addText((text: TextComponent) => {
          text.setPlaceholder('## Journal')
            .setValue((this.plugin.settings as any).insertHeadingName || '')
            .onChange(async (value) => {
              (this.plugin.settings as any).insertHeadingName = value;
              await this.plugin.saveSettings();
            });
        });
    }

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
      .setName('Organize by year/month')
      .setDesc('Nest daily notes under YYYY/MM subfolders')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue((this.plugin.settings as any).organizeByYearMonth || false);
        toggle.onChange(async (value) => {
          (this.plugin.settings as any).organizeByYearMonth = value;
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
            this.display();
          });
        ta.inputEl.cols = 40;
        ta.inputEl.rows = 4;
      });

    
    new Setting(containerEl)
      .setName('Template preset')
      .setDesc('Quickly choose a template')
      .addDropdown((dd: DropdownComponent) => {
        const presets: Record<string, string> = {
          minimal: '{{prompt}}\n\n{{user_line}}',
          conversation: '**Nova**: {{prompt}}\n\n{{user_line}}',
          dated: '# {{date:YYYY-MM-DD}}\n\n**Nova**: {{prompt}}\n\n{{user_line}}',
        };
        dd.addOptions({ minimal: 'Minimal', conversation: 'Conversation', dated: 'With date', custom: 'Custom' });
        const current = (this.plugin.settings.promptTemplate || '').trim();
        const currentPreset = current === presets.minimal
          ? 'minimal'
          : current === presets.conversation
            ? 'conversation'
            : current === presets.dated
              ? 'dated'
              : 'custom';
        dd.setValue(currentPreset);
        dd.onChange(async (v) => {
          if (v === 'minimal') this.plugin.settings.promptTemplate = presets.minimal;
          else if (v === 'conversation') this.plugin.settings.promptTemplate = presets.conversation;
          else if (v === 'dated') this.plugin.settings.promptTemplate = presets.dated;
          
          await this.plugin.saveSettings();
          this.display();
        });
      });

    
    const preview = containerEl.createEl('div');
    preview.style.padding = '8px';
    preview.style.border = '1px solid var(--background-modifier-border)';
    preview.style.marginBottom = '8px';
    const now = new Date();
    const fmt = (d: Date, f: string) => {
      const yyyy = d.getFullYear().toString();
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const dd = d.getDate().toString().padStart(2, '0');
      const HH = d.getHours().toString().padStart(2, '0');
      const Min = d.getMinutes().toString().padStart(2, '0');
      return f.replace(/YYYY/g, yyyy).replace(/MM/g, mm).replace(/DD/g, dd).replace(/HH/g, HH).replace(/mm/g, Min);
    };
    const samplePrompt = 'What are you grateful for today?';
    let out = (this.plugin.settings.promptTemplate || '').trim();
    out = out.replace(/\{\{\s*prompt\s*\}\}/g, samplePrompt);
    out = out.replace(/\{\{\s*user_line\s*\}\}/g, `**${this.plugin.settings.userName || 'You'}** (you): `);
    out = out.replace(/\{\{\s*date(?::([^}]+))?\s*\}\}/g, (_m, f) => fmt(now, typeof f === 'string' ? f.trim() : 'YYYY-MM-DD'));
    preview.setText(out);

    containerEl.createEl('h3', { text: 'AI (OpenAI only, optional)' });

    new Setting(containerEl)
      .setName('Enable AI')
      .addToggle(t => t.setValue(this.plugin.settings.aiEnabled).onChange(async (v) => {
        this.plugin.settings.aiEnabled = v;
        await this.plugin.saveSettings();
        this.display();
      }));

    if (this.plugin.settings.aiEnabled) {
      
      const keyLooksValid = (this.plugin.settings.aiApiKey || '').startsWith('sk-');
      const modelLooksOpenAI = /^(gpt|o\d)/i.test(this.plugin.settings.aiModel || '');

      new Setting(containerEl)
        .setName('OpenAI API Key')
        .setDesc(keyLooksValid ? 'Stored locally. Only OpenAI is supported for now.' : 'Key format looks unusual. It should start with sk- for OpenAI.')
        .addText(t => t.setPlaceholder('sk-...')
          .setValue(this.plugin.settings.aiApiKey)
          .onChange(async (v) => {
            this.plugin.settings.aiApiKey = v;
            await this.plugin.saveSettings();
            this.display();
          }));

      new Setting(containerEl)
        .setName('OpenAI model')
        .setDesc(modelLooksOpenAI ? 'e.g., gpt-5-mini. Only OpenAI models are supported for now.' : 'Model name may not be an OpenAI model (e.g., gpt-5-mini).')
        .addText(t => t.setPlaceholder('gpt-5-mini')
          .setValue(this.plugin.settings.aiModel)
          .onChange(async (v) => {
            this.plugin.settings.aiModel = v || 'gpt-5-mini';
            await this.plugin.saveSettings();
            this.display();
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

      
      new Setting(containerEl)
        .setName('Typewriter speed')
        .setDesc('Controls the animation speed for AI responses')
        .addDropdown((dd: DropdownComponent) => {
          dd.addOptions({ slow: 'Slow', normal: 'Normal', fast: 'Fast' });
          dd.setValue(((this.plugin.settings as any).typewriterSpeed || 'normal'));
          dd.onChange(async (v) => {
            (this.plugin.settings as any).typewriterSpeed = (v as any) || 'normal';
            await this.plugin.saveSettings();
          });
        });

      
      new Setting(containerEl)
        .setName('Test OpenAI')
        .setDesc('Sends a tiny request to validate your key/model')
        .addButton(b => b.setButtonText('Run test').onClick(async () => {
          const key = this.plugin.settings.aiApiKey;
          const model = this.plugin.settings.aiModel || 'gpt-5-mini';
          if (!key) { new Notice('Set your OpenAI API key first.'); return; }
          try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
              body: JSON.stringify({ model, messages: [{ role: 'system', content: 'ping' }, { role: 'user', content: 'ping' }], max_tokens: 1 })
            });
            if (resp.ok) new Notice('OpenAI test: OK'); else new Notice(`OpenAI test failed: ${resp.status} ${resp.statusText}`);
          } catch (e: any) {
            new Notice(`OpenAI test error: ${e?.message || e}`);
          }
        }));
    }
  }
}


