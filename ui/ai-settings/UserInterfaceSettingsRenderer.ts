import { DropdownComponent, Setting } from 'obsidian';
import { SettingsValidator } from '../../settings/PluginSettings';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';
import type NovaJournalPlugin from '../../main';

export class UserInterfaceSettingsRenderer {
  private readonly plugin: NovaJournalPlugin;

  constructor(plugin: NovaJournalPlugin) {
    this.plugin = plugin;
  }

  renderUserInterfaceSection(containerEl: HTMLElement): void {
    this.renderTypewriterSpeedSetting(containerEl);
    this.renderDeepenScopeSetting(containerEl);
    this.renderExploreLinkLabelSetting(containerEl);
    this.renderUserDisplayNameSetting(containerEl);
  }

  private renderTypewriterSpeedSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Typewriter speed')
      .setDesc('Controls the animation speed for AI responses')
      .addDropdown((dropdown: DropdownComponent) => {
        const handleTypewriterSpeedChange = async (value: string): Promise<void> => {
          try {
            this.plugin.settings.typewriterSpeed = SettingsValidator.validateTypewriterSpeed(value);
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save typewriter speed');
          }
        };

        dropdown.addOptions({
          slow: 'Slow',
          normal: 'Normal',
          fast: 'Fast',
        });
        dropdown.setValue(this.plugin.settings.typewriterSpeed ?? 'normal');
        dropdown.onChange(handleTypewriterSpeedChange);
      });
  }

  private renderDeepenScopeSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Default deepen scope')
      .setDesc('What Explore more targets by default')
      .addDropdown(dropdown => {
        const handleDeepenScopeChange = async (value: string): Promise<void> => {
          try {
            this.plugin.settings.defaultDeepenScope = SettingsValidator.validateDeepenScope(value);
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save deepen scope');
          }
        };

        dropdown.addOptions({
          line: 'Current line',
          note: 'Whole note',
        });
        dropdown.setValue(this.plugin.settings.defaultDeepenScope);
        dropdown.onChange(handleDeepenScopeChange);
      });
  }

  private renderExploreLinkLabelSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Explore link label')
      .setDesc('Shown under your last line, e.g., "Explore more"')
      .addText(text => {
        const handleLabelChange = async (value: string): Promise<void> => {
          try {
            this.plugin.settings.deepenButtonLabel = value ?? 'Explore more';
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save button label');
          }
        };

        text.setValue(this.plugin.settings.deepenButtonLabel).onChange(handleLabelChange);
      });
  }

  private renderUserDisplayNameSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Your display name')
      .setDesc('Used in conversation blocks (e.g., "Name (you): …")')
      .addText(text => {
        const handleUserNameChange = async (value: string): Promise<void> => {
          try {
            this.plugin.settings.userName = value ?? 'You';
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save display name');
          }
        };

        text.setValue(this.plugin.settings.userName).onChange(handleUserNameChange);
      });
  }
}
