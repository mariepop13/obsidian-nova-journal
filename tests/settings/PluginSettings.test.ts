import {
  ALLOWED_DATE_FORMATS,
  DEFAULT_SETTINGS,
  DateFormatter,
  RETRY_LIMITS,
  SettingsValidator,
  TOKEN_LIMITS,
  TemplateFactory,
  normalizeSettings,
} from '../../settings/PluginSettings';

describe('PluginSettings', () => {
  describe('normalizeSettings', () => {
    test('returns default settings for empty input', () => {
      const result = normalizeSettings({});
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    test('sanitizes prompt template by removing HTML tags', () => {
      const input = {
        promptTemplate: '<script>alert("xss")</script>{{prompt}}',
      };
      const result = normalizeSettings(input);
      expect(result.promptTemplate).toBe('{{prompt}}');
    });

    test('removes dangerous protocols from prompt template', () => {
      const input = {
        promptTemplate: 'javascript:alert("xss") {{prompt}}',
      };
      const result = normalizeSettings(input);
      expect(result.promptTemplate).toBe('alert("xss") {{prompt}}');
    });

    test('truncates long strings to safe limits', () => {
      const input = {
        aiSystemPrompt: 'a'.repeat(3000),
        aiApiKey: 'b'.repeat(600),
        dailyNoteFolder: 'c'.repeat(300),
        sectionHeading: 'd'.repeat(150),
        userName: 'e'.repeat(80),
      };
      const result = normalizeSettings(input);
      
      expect(result.aiSystemPrompt).toHaveLength(2000);
      expect(result.aiApiKey).toHaveLength(500);
      expect(result.dailyNoteFolder).toHaveLength(200);
      expect(result.sectionHeading).toHaveLength(100);
      expect(result.userName).toHaveLength(50);
    });

    test('validates and corrects invalid enum values', () => {
      const input = {
        typewriterSpeed: 'invalid' as any,
        defaultDeepenScope: 'invalid' as any,
        buttonStyle: 'invalid' as any,
        buttonPosition: 'invalid' as any,
        dailyNoteFormat: 'invalid',
      };
      const result = normalizeSettings(input);
      
      expect(result.typewriterSpeed).toBe(DEFAULT_SETTINGS.typewriterSpeed);
      expect(result.defaultDeepenScope).toBe(DEFAULT_SETTINGS.defaultDeepenScope);
      expect(result.buttonStyle).toBe(DEFAULT_SETTINGS.buttonStyle);
      expect(result.buttonPosition).toBe(DEFAULT_SETTINGS.buttonPosition);
      expect(result.dailyNoteFormat).toBe(DEFAULT_SETTINGS.dailyNoteFormat);
    });

    test('validates token and retry limits', () => {
      const input = {
        aiMaxTokens: -100,
        aiRetryCount: 999,
      };
      const result = normalizeSettings(input);
      
      expect(result.aiMaxTokens).toBe(TOKEN_LIMITS.MIN);
      expect(result.aiRetryCount).toBe(RETRY_LIMITS.MAX);
    });

    test('handles null and undefined values gracefully', () => {
      const input = {
        aiSystemPrompt: undefined,
        dailyNoteFolder: undefined,
        userName: '',
      };
      const result = normalizeSettings(input);
      
      expect(result.aiSystemPrompt).toBe(DEFAULT_SETTINGS.aiSystemPrompt);
      expect(result.dailyNoteFolder).toBe(DEFAULT_SETTINGS.dailyNoteFolder);
      expect(result.userName).toBe(DEFAULT_SETTINGS.userName);
    });
  });

  describe('SettingsValidator', () => {
    describe('validateTokens', () => {
      test('enforces minimum token limit', () => {
        expect(SettingsValidator.validateTokens(-10)).toBe(TOKEN_LIMITS.MIN);
        expect(SettingsValidator.validateTokens(0)).toBe(TOKEN_LIMITS.MIN);
      });

      test('enforces maximum token limit', () => {
        expect(SettingsValidator.validateTokens(5000)).toBe(TOKEN_LIMITS.MAX);
        expect(SettingsValidator.validateTokens(10000)).toBe(TOKEN_LIMITS.MAX);
      });

      test('allows valid token values', () => {
        expect(SettingsValidator.validateTokens(100)).toBe(100);
        expect(SettingsValidator.validateTokens(TOKEN_LIMITS.DEFAULT)).toBe(TOKEN_LIMITS.DEFAULT);
      });
    });

    describe('validateRetryCount', () => {
      test('enforces minimum retry count', () => {
        expect(SettingsValidator.validateRetryCount(-5)).toBe(RETRY_LIMITS.MIN);
      });

      test('enforces maximum retry count', () => {
        expect(SettingsValidator.validateRetryCount(50)).toBe(RETRY_LIMITS.MAX);
      });

      test('allows valid retry counts', () => {
        expect(SettingsValidator.validateRetryCount(3)).toBe(3);
        expect(SettingsValidator.validateRetryCount(RETRY_LIMITS.DEFAULT)).toBe(RETRY_LIMITS.DEFAULT);
      });
    });

    describe('validateDateFormat', () => {
      test('accepts valid date formats', () => {
        expect(SettingsValidator.validateDateFormat('YYYY-MM-DD')).toBe('YYYY-MM-DD');
        expect(SettingsValidator.validateDateFormat('YYYY-MM-DD_HH-mm')).toBe('YYYY-MM-DD_HH-mm');
      });

      test('rejects invalid date formats', () => {
        expect(SettingsValidator.validateDateFormat('invalid')).toBe(DEFAULT_SETTINGS.dailyNoteFormat);
        expect(SettingsValidator.validateDateFormat('')).toBe(DEFAULT_SETTINGS.dailyNoteFormat);
      });
    });

    describe('validateTypewriterSpeed', () => {
      test('accepts valid speeds', () => {
        expect(SettingsValidator.validateTypewriterSpeed('slow')).toBe('slow');
        expect(SettingsValidator.validateTypewriterSpeed('normal')).toBe('normal');
        expect(SettingsValidator.validateTypewriterSpeed('fast')).toBe('fast');
      });

      test('rejects invalid speeds', () => {
        expect(SettingsValidator.validateTypewriterSpeed('invalid')).toBe(DEFAULT_SETTINGS.typewriterSpeed);
        expect(SettingsValidator.validateTypewriterSpeed('')).toBe(DEFAULT_SETTINGS.typewriterSpeed);
      });
    });

    describe('validateDeepenScope', () => {
      test('accepts valid scopes', () => {
        expect(SettingsValidator.validateDeepenScope('line')).toBe('line');
        expect(SettingsValidator.validateDeepenScope('note')).toBe('note');
      });

      test('rejects invalid scopes', () => {
        expect(SettingsValidator.validateDeepenScope('invalid')).toBe(DEFAULT_SETTINGS.defaultDeepenScope);
      });
    });

    describe('validateButtonStyle', () => {
      test('accepts valid button styles', () => {
        expect(SettingsValidator.validateButtonStyle('button')).toBe('button');
        expect(SettingsValidator.validateButtonStyle('link')).toBe('link');
        expect(SettingsValidator.validateButtonStyle('minimal')).toBe('minimal');
        expect(SettingsValidator.validateButtonStyle('pill')).toBe('pill');
      });

      test('rejects invalid button styles', () => {
        expect(SettingsValidator.validateButtonStyle('invalid')).toBe(DEFAULT_SETTINGS.buttonStyle);
      });
    });

    describe('validateButtonPosition', () => {
      test('accepts valid button positions', () => {
        expect(SettingsValidator.validateButtonPosition('bottom')).toBe('bottom');
        expect(SettingsValidator.validateButtonPosition('inline')).toBe('inline');
        expect(SettingsValidator.validateButtonPosition('both')).toBe('both');
      });

      test('rejects invalid button positions', () => {
        expect(SettingsValidator.validateButtonPosition('invalid')).toBe(DEFAULT_SETTINGS.buttonPosition);
      });
    });
  });

  describe('TemplateFactory', () => {
    test('getPreset returns correct templates', () => {
      expect(TemplateFactory.getPreset('minimal')).toBe('{{prompt}}\n\n{{user_line}}');
      expect(TemplateFactory.getPreset('conversation')).toBe('**Nova**: {{prompt}}\n\n{{user_line}}');
      expect(TemplateFactory.getPreset('dated')).toBe('# {{date:YYYY-MM-DD}}\n\n**Nova**: {{prompt}}\n\n{{user_line}}');
    });

    test('getPresetType identifies preset types correctly', () => {
      expect(TemplateFactory.getPresetType('{{prompt}}\n\n{{user_line}}')).toBe('minimal');
      expect(TemplateFactory.getPresetType('**Nova**: {{prompt}}\n\n{{user_line}}')).toBe('conversation');
      expect(TemplateFactory.getPresetType('# {{date:YYYY-MM-DD}}\n\n**Nova**: {{prompt}}\n\n{{user_line}}')).toBe('dated');
      expect(TemplateFactory.getPresetType('custom template')).toBe('custom');
    });

    test('getAllPresets returns all presets', () => {
      const presets = TemplateFactory.getAllPresets();
      expect(Object.keys(presets)).toEqual(['minimal', 'conversation', 'dated']);
    });
  });

  describe('DateFormatter', () => {
    const testDate = new Date(2024, 0, 15, 10, 30, 45, 123);

    test('formats YYYY-MM-DD correctly', () => {
      expect(DateFormatter.format(testDate, 'YYYY-MM-DD')).toBe('2024-01-15');
    });

    test('formats YYYY-MM-DD_HH-mm correctly', () => {
      expect(DateFormatter.format(testDate, 'YYYY-MM-DD_HH-mm')).toBe('2024-01-15_10-30');
    });

    test('handles edge cases for date formatting', () => {
      const edgeDate = new Date(2024, 1, 9, 9, 5, 0, 0);
      expect(DateFormatter.format(edgeDate, 'YYYY-MM-DD_HH-mm')).toBe('2024-02-09_09-05');
    });

    test('getPreviewFilename includes .md extension', () => {
      const filename = DateFormatter.getPreviewFilename('YYYY-MM-DD', testDate);
      expect(filename).toBe('2024-01-15.md');
    });

    test('getPreviewFilename uses current date by default', () => {
      const filename = DateFormatter.getPreviewFilename('YYYY-MM-DD');
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}\.md$/);
    });
  });

  describe('Constants and Types', () => {
    test('TOKEN_LIMITS are properly defined', () => {
      expect(TOKEN_LIMITS.MIN).toBe(1);
      expect(TOKEN_LIMITS.MAX).toBe(4096);
      expect(TOKEN_LIMITS.DEFAULT).toBe(800);
    });

    test('RETRY_LIMITS are properly defined', () => {
      expect(RETRY_LIMITS.MIN).toBe(0);
      expect(RETRY_LIMITS.MAX).toBe(10);
      expect(RETRY_LIMITS.DEFAULT).toBe(2);
    });

    test('ALLOWED_DATE_FORMATS contains expected formats', () => {
      expect(ALLOWED_DATE_FORMATS.has('YYYY-MM-DD')).toBe(true);
      expect(ALLOWED_DATE_FORMATS.has('YYYY-MM-DD_HH-mm')).toBe(true);
      expect(ALLOWED_DATE_FORMATS.has('invalid')).toBe(false);
    });

    test('DEFAULT_SETTINGS has all required properties', () => {
      const requiredProperties = [
        'promptStyle', 'insertLocation', 'dailyNoteFolder',
        'aiEnabled', 'aiApiKey', 'aiModel', 'userName'
      ];
      
      requiredProperties.forEach(prop => {
        expect(DEFAULT_SETTINGS).toHaveProperty(prop);
      });
    });
  });

  describe('Integration Tests', () => {
    test('normalizeSettings with complex invalid input', () => {
      const maliciousInput = {
        promptTemplate: '<script>window.location="http://evil.com"</script>{{prompt}}',
        aiSystemPrompt: `javascript:void(0)${  'a'.repeat(3000)}`,
        aiMaxTokens: -999999,
        aiRetryCount: 999999,
        typewriterSpeed: 'ultra-fast' as any,
        buttonStyle: 'rainbow' as any,
        dailyNoteFormat: 'MM/DD/YYYY',
        userName: undefined,
      };
      
      const result = normalizeSettings(maliciousInput);
      
      expect(result.promptTemplate).not.toContain('<script>');
      expect(result.promptTemplate).not.toContain('window.location');
      expect(result.aiSystemPrompt).not.toContain('javascript:');
      expect(result.aiSystemPrompt).toHaveLength(2000);
      expect(result.aiMaxTokens).toBe(TOKEN_LIMITS.MIN);
      expect(result.aiRetryCount).toBe(RETRY_LIMITS.MAX);
      expect(result.typewriterSpeed).toBe(DEFAULT_SETTINGS.typewriterSpeed);
      expect(result.buttonStyle).toBe(DEFAULT_SETTINGS.buttonStyle);
      expect(result.dailyNoteFormat).toBe(DEFAULT_SETTINGS.dailyNoteFormat);
      expect(result.userName).toBe(DEFAULT_SETTINGS.userName);
    });
  });
});
