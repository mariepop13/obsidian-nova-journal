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
        dropdown.addOptions({
          slow: 'Slow',
          normal: 'Normal',
          fast: 'Fast',
        });
        dropdown.setValue(this.plugin.settings.typewriterSpeed ?? 'normal');
        dropdown.onChange(async value => {
          try {
            this.plugin.settings.typewriterSpeed = SettingsValidator.validateTypewriterSpeed(value);
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save typewriter speed');
          }
        });
      });
  }

  private renderDeepenScopeSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Default deepen scope')
      .setDesc('What Explore more targets by default')
      .addDropdown(dropdown => {
        dropdown.addOptions({
          line: 'Current line',
          note: 'Whole note',
        });
        dropdown.setValue(this.plugin.settings.defaultDeepenScope);
        dropdown.onChange(async value => {
          try {
            this.plugin.settings.defaultDeepenScope = SettingsValidator.validateDeepenScope(value);
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save deepen scope');
          }
        });
      });
  }

  private renderExploreLinkLabelSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Explore link label')
      .setDesc('Shown under your last line, e.g., "Explore more"')
      .addText(text =>
        text.setValue(this.plugin.settings.deepenButtonLabel).onChange(async value => {
          try {
            this.plugin.settings.deepenButtonLabel = value ?? 'Explore more';
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save button label');
          }
        })
      );
  }

  private renderUserDisplayNameSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Your display name')
      .setDesc('Used in conversation blocks (e.g., "Name (you): …")')
      .addText(text =>
        text.setValue(this.plugin.settings.userName).onChange(async value => {
          try {
            this.plugin.settings.userName = value ?? 'You';
            await this.plugin.saveSettings();
          } catch {
            ToastSpinnerService.error('Failed to save display name');
          }
        })
      );
  }
}
