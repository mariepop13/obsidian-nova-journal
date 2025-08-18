import { DropdownComponent, Setting, ToggleComponent } from 'obsidian';
import { SettingsValidator } from '../../settings/PluginSettings';
import { ButtonCustomizationService } from '../../services/editor/ButtonCustomizationService';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';
import type NovaJournalPlugin from '../../main';

export class ButtonCustomizationSettingsRenderer {
  private readonly plugin: NovaJournalPlugin;

  constructor(plugin: NovaJournalPlugin) {
    this.plugin = plugin;
  }

  renderButtonCustomizationSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Button Customization' });

    this.renderButtonStyleSetting(containerEl);
    this.renderButtonPositionSetting(containerEl);
    this.renderButtonThemeSetting(containerEl);
    this.renderMoodButtonLabelSetting(containerEl);
    this.renderShowMoodButtonSetting(containerEl);
  }

  private renderButtonStyleSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Button style')
      .setDesc('Visual style for deepen and mood analysis buttons')
      .addDropdown(dropdown => {
        const styles = ButtonCustomizationService.getAvailableStyles();
        const options: Record<string, string> = {};
        styles.forEach(style => (options[style.value] = style.label));

        dropdown.addOptions(options);
        dropdown.setValue(this.plugin.settings.buttonStyle);
        dropdown.onChange(async value => {
          try {
            this.plugin.settings.buttonStyle = SettingsValidator.validateButtonStyle(value);
            await this.plugin.saveSettings();
          } catch (error) {
            ToastSpinnerService.error('Failed to save button style');
          }
        });
      });
  }

  private renderButtonPositionSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Button position')
      .setDesc('Where buttons should appear in your notes')
      .addDropdown(dropdown => {
        const positions = ButtonCustomizationService.getAvailablePositions();
        const options: Record<string, string> = {};
        positions.forEach(pos => (options[pos.value] = pos.label));

        dropdown.addOptions(options);
        dropdown.setValue(this.plugin.settings.buttonPosition);
        dropdown.onChange(async value => {
          try {
            this.plugin.settings.buttonPosition = SettingsValidator.validateButtonPosition(value);
            await this.plugin.saveSettings();
          } catch (error) {
            ToastSpinnerService.error('Failed to save button position');
          }
        });
      });
  }

  private renderButtonThemeSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Button theme')
      .setDesc('Color theme for buttons')
      .addDropdown(dropdown => {
        const themes = ButtonCustomizationService.getAvailableThemes();
        const options: Record<string, string> = {};
        themes.forEach(theme => (options[theme.value] = theme.label));

        dropdown.addOptions(options);
        dropdown.setValue(this.plugin.settings.buttonTheme);
        dropdown.onChange(async value => {
          try {
            this.plugin.settings.buttonTheme = value;
            await this.plugin.saveSettings();
          } catch (error) {
            ToastSpinnerService.error('Failed to save button theme');
          }
        });
      });
  }

  private renderMoodButtonLabelSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Mood button label')
      .setDesc('Text shown on the mood analysis button')
      .addText(text =>
        text.setValue(this.plugin.settings.moodButtonLabel).onChange(async value => {
          try {
            this.plugin.settings.moodButtonLabel = value || 'Analyze mood';
            await this.plugin.saveSettings();
          } catch (error) {
            ToastSpinnerService.error('Failed to save mood button label');
          }
        })
      );
  }

  private renderShowMoodButtonSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Show mood button')
      .setDesc('Display the mood analysis button alongside deepen buttons')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showMoodButton).onChange(async value => {
          try {
            this.plugin.settings.showMoodButton = value;
            await this.plugin.saveSettings();
          } catch (error) {
            ToastSpinnerService.error('Failed to save mood button setting');
          }
        })
      );
  }
}
