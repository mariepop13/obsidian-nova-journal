import type { PromptStyle } from '../prompt/PromptRegistry';

export type InsertionLocation = 'cursor' | 'top' | 'bottom';
export type EnhancedInsertionLocation = InsertionLocation | 'below-heading';
export type TypewriterSpeed = 'slow' | 'normal' | 'fast';
export type DeepenScope = 'line' | 'note';
export type PromptPreset = 'minimal' | 'conversation' | 'dated';
export type ButtonStyle = 'button' | 'link' | 'minimal' | 'pill';
export type ButtonPosition = 'bottom' | 'inline' | 'both';

export const MODEL_DEFAULTS = {
  PRIMARY: 'gpt-4o-mini',
  FALLBACK: 'gpt-3.5-turbo'
} as const;

export const TOKEN_LIMITS = {
  MIN: 1,
  MAX: 4096,
  DEFAULT: 800
} as const;

export const RETRY_LIMITS = {
  MIN: 0,
  MAX: 10,
  DEFAULT: 2
} as const;

export const ALLOWED_DATE_FORMATS = new Set(['YYYY-MM-DD', 'YYYY-MM-DD_HH-mm']);

export interface NovaJournalSettings {
  promptStyle: PromptStyle;
  insertLocation: EnhancedInsertionLocation;
  addSectionHeading: boolean;
  sectionHeading: string;
  dailyNoteFolder: string;
  dailyNoteFormat: string; // Limited support: YYYY-MM-DD
  promptTemplate: string; // If provided, used to render the inserted block
  preventDuplicateForDay: boolean;
  insertHeadingName: string;
  organizeByYearMonth: boolean;
  aiEnabled: boolean;
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
  deepenButtonLabel: string;
  userName: string;
  aiDebug: boolean;
  defaultDeepenScope: DeepenScope;
  aiMaxTokens: number;
  aiRetryCount: number;
  aiFallbackModel: string;
  typewriterSpeed: TypewriterSpeed;
  buttonStyle: ButtonStyle;
  buttonPosition: ButtonPosition;
  moodButtonLabel: string;
  showMoodButton: boolean;
  buttonTheme: string;
}

export const DEFAULT_SETTINGS: NovaJournalSettings = {
  promptStyle: 'reflective',
  insertLocation: 'cursor',
  addSectionHeading: true,
  sectionHeading: '## Journal Prompt',
  dailyNoteFolder: 'Journal',
  dailyNoteFormat: 'YYYY-MM-DD_HH-mm',
  promptTemplate: '**Nova**: {{prompt}}\n\n{{user_line}}',
  preventDuplicateForDay: true,
  insertHeadingName: '',
  organizeByYearMonth: false,
  aiEnabled: false,
  aiApiKey: '',
  aiModel: MODEL_DEFAULTS.PRIMARY,
  aiSystemPrompt: 'You are Nova, a concise reflective journaling companion. Respond in 1-3 short sentences that deepen the user\'s thought with empathy and specificity.',
  deepenButtonLabel: 'Explore more',
  userName: 'You',
  aiDebug: false,
  defaultDeepenScope: 'line',
  aiMaxTokens: TOKEN_LIMITS.DEFAULT,
  aiRetryCount: RETRY_LIMITS.DEFAULT,
  aiFallbackModel: '',
  typewriterSpeed: 'normal',
  buttonStyle: 'button',
  buttonPosition: 'bottom',
  moodButtonLabel: 'Analyze mood',
  showMoodButton: true,
  buttonTheme: 'default',
};

export class TemplateFactory {
  private static readonly PRESETS: Record<PromptPreset, string> = {
    minimal: '{{prompt}}\n\n{{user_line}}',
    conversation: '**Nova**: {{prompt}}\n\n{{user_line}}',
    dated: '# {{date:YYYY-MM-DD}}\n\n**Nova**: {{prompt}}\n\n{{user_line}}'
  };

  static getPreset(type: PromptPreset): string {
    return this.PRESETS[type];
  }

  static getPresetType(template: string): PromptPreset | 'custom' {
    const trimmed = template.trim();
    for (const [preset, tpl] of Object.entries(this.PRESETS)) {
      if (trimmed === tpl) {
        return preset as PromptPreset;
      }
    }
    return 'custom';
  }

  static getAllPresets(): Record<PromptPreset, string> {
    return { ...this.PRESETS };
  }
}

export class DateFormatter {
  static format(date: Date, format: string): string {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const HH = date.getHours().toString().padStart(2, '0');
    const Min = date.getMinutes().toString().padStart(2, '0');
    
    return format
      .replace(/YYYY/g, yyyy)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd)
      .replace(/HH/g, HH)
      .replace(/mm/g, Min);
  }

  static getPreviewFilename(format: string, date: Date = new Date()): string {
    return `${this.format(date, format)}.md`;
  }
}

export class SettingsValidator {
  static validateTokens(value: number): number {
    return Math.max(TOKEN_LIMITS.MIN, Math.min(TOKEN_LIMITS.MAX, value));
  }

  static validateRetryCount(value: number): number {
    return Math.max(RETRY_LIMITS.MIN, Math.min(RETRY_LIMITS.MAX, value));
  }

  static validateDateFormat(format: string): string {
    return ALLOWED_DATE_FORMATS.has(format) ? format : DEFAULT_SETTINGS.dailyNoteFormat;
  }

  static validateTypewriterSpeed(speed: string): TypewriterSpeed {
    const validSpeeds: TypewriterSpeed[] = ['slow', 'normal', 'fast'];
    return validSpeeds.includes(speed as TypewriterSpeed) 
      ? speed as TypewriterSpeed 
      : DEFAULT_SETTINGS.typewriterSpeed;
  }

  static validateDeepenScope(scope: string): DeepenScope {
    const validScopes: DeepenScope[] = ['line', 'note'];
    return validScopes.includes(scope as DeepenScope)
      ? scope as DeepenScope
      : DEFAULT_SETTINGS.defaultDeepenScope;
  }

  static validateButtonStyle(style: string): ButtonStyle {
    const validStyles: ButtonStyle[] = ['button', 'link', 'minimal', 'pill'];
    return validStyles.includes(style as ButtonStyle)
      ? style as ButtonStyle
      : DEFAULT_SETTINGS.buttonStyle;
  }

  static validateButtonPosition(position: string): ButtonPosition {
    const validPositions: ButtonPosition[] = ['bottom', 'inline', 'both'];
    return validPositions.includes(position as ButtonPosition)
      ? position as ButtonPosition
      : DEFAULT_SETTINGS.buttonPosition;
  }
}

export function normalizeSettings(input: Partial<NovaJournalSettings>): NovaJournalSettings {
  const s: NovaJournalSettings = { ...DEFAULT_SETTINGS, ...input };
  
  return {
    ...s,
    promptTemplate: (s.promptTemplate || '').replace(/\s+$/, ''),
    dailyNoteFormat: SettingsValidator.validateDateFormat(s.dailyNoteFormat),
    typewriterSpeed: SettingsValidator.validateTypewriterSpeed(s.typewriterSpeed),
    defaultDeepenScope: SettingsValidator.validateDeepenScope(s.defaultDeepenScope),
    aiMaxTokens: SettingsValidator.validateTokens(s.aiMaxTokens),
    aiRetryCount: SettingsValidator.validateRetryCount(s.aiRetryCount),
    buttonStyle: SettingsValidator.validateButtonStyle(s.buttonStyle),
    buttonPosition: SettingsValidator.validateButtonPosition(s.buttonPosition),
    moodButtonLabel: (s.moodButtonLabel || '').trim() || DEFAULT_SETTINGS.moodButtonLabel,
    deepenButtonLabel: (s.deepenButtonLabel || '').trim() || DEFAULT_SETTINGS.deepenButtonLabel,
    buttonTheme: (s.buttonTheme || '').trim() || DEFAULT_SETTINGS.buttonTheme,
  };
}

