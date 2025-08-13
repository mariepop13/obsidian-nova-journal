import type { ButtonStyle, ButtonPosition, NovaJournalSettings } from '../../settings/PluginSettings';

export interface ButtonConfig {
  label: string;
  cssClass: string;
  dataAttributes: Record<string, string>;
  style: ButtonStyle;
  theme: string;
}

export interface ButtonGenerationConfig {
  deepenLabel: string;
  moodLabel: string;
  style: ButtonStyle;
  position: ButtonPosition;
  theme: string;
  showMoodButton: boolean;
  scope?: string;
  lineNumber?: number;
}

export class ButtonCustomizationService {
  static generateButtonMarkup(config: ButtonGenerationConfig): string {
    const buttons: string[] = [];

    if (config.scope === 'note' || !config.lineNumber) {
      buttons.push(this.createDeepenButton({
        label: config.deepenLabel,
        cssClass: 'nova-deepen',
        dataAttributes: { 'data-scope': 'note' },
        style: config.style,
        theme: config.theme
      }));
    } else {
      buttons.push(this.createDeepenButton({
        label: config.deepenLabel,
        cssClass: 'nova-deepen',
        dataAttributes: { 'data-line': config.lineNumber.toString() },
        style: config.style,
        theme: config.theme
      }));
    }

    if (config.showMoodButton) {
      buttons.push(this.createMoodButton({
        label: config.moodLabel,
        cssClass: 'nova-mood-analyze',
        dataAttributes: {},
        style: config.style,
        theme: config.theme
      }));
    }

    return this.wrapButtons(buttons, config.position);
  }

  private static createDeepenButton(config: ButtonConfig): string {
    return this.createButton(config);
  }

  private static createMoodButton(config: ButtonConfig): string {
    return this.createButton(config);
  }

  private static createButton(config: ButtonConfig): string {
    const tagName = this.getTagName(config.style);
    const classNames = this.getClassNames(config);
    const attributes = this.formatDataAttributes(config.dataAttributes);
    const styles = this.getInlineStyles(config);

    return `<${tagName} class="${classNames}"${attributes}${styles}>${config.label}</${tagName}>`;
  }

  private static getTagName(style: ButtonStyle): string {
    switch (style) {
      case 'link':
        return 'a';
      case 'button':
      case 'minimal':
      case 'pill':
      default:
        return 'button';
    }
  }

  private static getClassNames(config: ButtonConfig): string {
    const classes = [config.cssClass];
    
    classes.push(`nova-btn-${config.style}`);
    
    if (config.theme && config.theme !== 'default') {
      classes.push(`nova-btn-theme-${config.theme}`);
    }

    return classes.join(' ');
  }

  private static formatDataAttributes(attributes: Record<string, string>): string {
    return Object.entries(attributes)
      .filter(([_, v]) => v != null && String(v).length > 0)
      .map(([key, value]) => {
        const safeKey = key.startsWith('data-') ? key : `data-${key}`;
        const safeValue = String(value).replace(/"/g, '&quot;');
        return ` ${safeKey}="${safeValue}"`;
      })
      .join('');
  }

  private static getInlineStyles(config: ButtonConfig): string {
    if (config.style === 'minimal') {
      return ' style="background: none; border: none; text-decoration: underline; cursor: pointer; color: var(--text-accent);"';
    }
    
    if (config.style === 'pill') {
      return ' style="border-radius: 20px; padding: 4px 12px; font-size: 0.85em;"';
    }

    return '';
  }

  private static wrapButtons(buttons: string[], position: ButtonPosition): string {
    const buttonGroup = buttons.join(' ');
    
    switch (position) {
      case 'inline':
        return buttonGroup;
      case 'bottom':
      case 'both':
      default:
        return `\n${buttonGroup}\n`;
    }
  }

  static createFromSettings(settings: NovaJournalSettings): ButtonGenerationConfig {
    return {
      deepenLabel: settings.deepenButtonLabel,
      moodLabel: settings.moodButtonLabel,
      style: settings.buttonStyle,
      position: settings.buttonPosition,
      theme: settings.buttonTheme,
      showMoodButton: settings.showMoodButton
    };
  }

  static getAvailableStyles(): Array<{ value: ButtonStyle; label: string; description: string }> {
    return [
      { value: 'button', label: 'Button', description: 'Standard button style' },
      { value: 'link', label: 'Link', description: 'Text link style' },
      { value: 'minimal', label: 'Minimal', description: 'Underlined text with no background' },
      { value: 'pill', label: 'Pill', description: 'Rounded button with pill shape' }
    ];
  }

  static getAvailablePositions(): Array<{ value: ButtonPosition; label: string; description: string }> {
    return [
      { value: 'bottom', label: 'Bottom', description: 'Always at the bottom of notes' },
      { value: 'inline', label: 'Inline', description: 'Within the text flow' },
      { value: 'both', label: 'Both', description: 'Inline + bottom (when appropriate)' }
    ];
  }

  static getAvailableThemes(): Array<{ value: string; label: string }> {
    return [
      { value: 'default', label: 'Default' },
      { value: 'accent', label: 'Accent' },
      { value: 'subtle', label: 'Subtle' },
      { value: 'primary', label: 'Primary' }
    ];
  }
}
