import { SettingsService } from '../../services/SettingsService';
import {
  DEFAULT_SETTINGS,
  type NovaJournalSettings,
  type SettingsExportData,
  type SettingsImportResult,
} from '../../settings/PluginSettings';
import { ToastSpinnerService } from '../../services/editor/ToastSpinnerService';

// Mock the ToastSpinnerService
jest.mock('../../services/editor/ToastSpinnerService', () => ({
  ToastSpinnerService: {
    notice: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
    readText: jest.fn(),
  },
});

// Mock document methods
const mockElement = {
  style: { display: '' },
  href: '',
  download: '',
  click: jest.fn(),
} as any;

const mockBody = {
  appendChild: jest.fn(),
  removeChild: jest.fn(),
} as any;

Object.assign(document, {
  createElement: jest.fn(() => mockElement),
});

// Mock document.body separately
Object.defineProperty(document, 'body', {
  value: mockBody,
  writable: true,
});

// Mock URL methods
Object.assign(global, {
  URL: {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn(),
  },
  Blob: jest.fn(),
});

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockApp: any;
  let mockPlugin: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockApp = {
      vault: {
        create: jest.fn(),
        read: jest.fn(),
      },
    };

    mockPlugin = {
      settings: { ...DEFAULT_SETTINGS },
      manifest: {
        version: '1.1.0',
      },
      saveSettings: jest.fn(),
    };

    settingsService = new SettingsService(mockApp, mockPlugin);
  });

  describe('exportSettings', () => {
    test('exports settings without API key by default', async () => {
      mockPlugin.settings.aiApiKey = 'test-api-key';
      
      const result = await settingsService.exportSettings();

      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.settings.aiApiKey).toBe('');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.exportedBy).toBe('Nova Journal Plugin');
      expect(result.metadata?.pluginVersion).toBe('1.1.0');
    });

    test('includes API key when requested', async () => {
      const testApiKey = 'test-api-key-123';
      mockPlugin.settings.aiApiKey = testApiKey;
      
      const result = await settingsService.exportSettings({ includeApiKey: true });

      expect(result.settings.aiApiKey).toBe(testApiKey);
    });

    test('excludes metadata when requested', async () => {
      const result = await settingsService.exportSettings({ includeMetadata: false });

      expect(result.metadata).toBeUndefined();
    });

    test('handles empty API key gracefully', async () => {
      mockPlugin.settings.aiApiKey = '';
      
      const result = await settingsService.exportSettings({ includeApiKey: true });

      expect(result.settings.aiApiKey).toBe('');
    });
  });

  describe('importSettings', () => {
    const validExportData: SettingsExportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings: {
        ...DEFAULT_SETTINGS,
        promptStyle: 'reflective',
        aiEnabled: true,
      },
    };

    test('successfully imports valid settings', async () => {
      const result = await settingsService.importSettings(validExportData);

      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
      expect(result.settings?.promptStyle).toBe('reflective');
      expect(result.settings?.aiEnabled).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('validates required fields', async () => {
      const invalidData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        settings: {} as any,
      };

      const result = await settingsService.importSettings(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing required field: promptStyle');
      expect(result.errors).toContain('Missing required field: insertLocation');
      expect(result.errors).toContain('Missing required field: dailyNoteFolder');
    });

    test('rejects data without version', async () => {
      const invalidData = {
        settings: DEFAULT_SETTINGS,
      } as any;

      const result = await settingsService.importSettings(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing version information');
    });

    test('rejects null or undefined data', async () => {
      const result = await settingsService.importSettings(null as any);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid data format');
    });

    test('rejects data without settings', async () => {
      const invalidData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      } as any;

      const result = await settingsService.importSettings(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing or invalid settings data');
    });

    test('successfully imports settings with API key', async () => {
      const dataWithApiKey = {
        ...validExportData,
        settings: {
          ...validExportData.settings,
          aiApiKey: 'test-api-key',
        },
      };

      const result = await settingsService.importSettings(dataWithApiKey);

      expect(result.success).toBe(true);
      expect(result.settings?.aiApiKey).toBe('test-api-key');
    });

    test('handles malformed data gracefully', async () => {
      const malformedData = {
        version: '1.0.0',
        timestamp: 'invalid-timestamp',
        settings: 'not-an-object',
      } as any;

      const result = await settingsService.importSettings(malformedData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Missing or invalid settings data');
    });
  });

  describe('loadSettingsFromFile', () => {
    test('rejects files larger than 1MB', async () => {
      const mockFile = {
        text: jest.fn().mockResolvedValue('large content'),
      };
      
      // Mock large file size
      Object.defineProperty(mockFile, 'size', {
        value: 1024 * 1024 + 1,
        writable: false,
      });

      const mockInput = {
        type: 'file',
        accept: '.json',
        onchange: null as any,
        click: jest.fn(),
        files: [mockFile],
      };

      (document.createElement as jest.Mock).mockReturnValue(mockInput);

      const resultPromise = settingsService.loadSettingsFromFile();
      
      // Simulate file selection with large content
      if (mockInput.onchange) {
        const largeContent = 'x'.repeat(1024 * 1024 + 1);
        mockFile.text = jest.fn().mockResolvedValue(largeContent);
        await mockInput.onchange({ target: { files: [mockFile] } } as any);
      }

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.errors).toContain('File too large. Maximum size is 1MB.');
    });

    test('handles JSON parse errors', async () => {
      const mockFile = {
        text: jest.fn().mockResolvedValue('invalid json {'),
      };

      const mockInput = {
        type: 'file',
        accept: '.json',
        onchange: null as any,
        click: jest.fn(),
      };

      (document.createElement as jest.Mock).mockReturnValue(mockInput);

      const resultPromise = settingsService.loadSettingsFromFile();
      
      // Simulate file selection
      if (mockInput.onchange) {
        await mockInput.onchange({ target: { files: [mockFile] } } as any);
      }

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid JSON format. Please check your file.');
    });

    test('handles no file selected', async () => {
      const mockInput = {
        type: 'file',
        accept: '.json',
        onchange: null as any,
        click: jest.fn(),
      };

      (document.createElement as jest.Mock).mockReturnValue(mockInput);

      const resultPromise = settingsService.loadSettingsFromFile();
      
      // Simulate no file selection
      if (mockInput.onchange) {
        await mockInput.onchange({ target: { files: null } } as any);
      }

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No file selected');
    });
  });

  describe('applyImportedSettings', () => {
    test('applies settings and shows success notification', async () => {
      const newSettings: NovaJournalSettings = {
        ...DEFAULT_SETTINGS,
        promptStyle: 'reflective',
      };

      await settingsService.applyImportedSettings(newSettings);

      expect(mockPlugin.settings).toEqual(newSettings);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
      expect(ToastSpinnerService.notice).toHaveBeenCalledWith('Settings imported successfully');
    });
  });

  describe('resetToDefaults', () => {
    test('resets settings to defaults', async () => {
      mockPlugin.settings = {
        ...DEFAULT_SETTINGS,
        promptStyle: 'reflective',
        aiEnabled: true,
      };

      await settingsService.resetToDefaults();

      expect(mockPlugin.settings).toEqual(DEFAULT_SETTINGS);
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
      expect(ToastSpinnerService.notice).toHaveBeenCalledWith('Settings reset to defaults');
    });
  });

  describe('saveSettingsWithFilePicker', () => {
    test('creates download link with proper filename', async () => {
      const mockAnchor = {
        href: '',
        download: '',
        style: { display: '' },
        click: jest.fn(),
      };

      (document.createElement as jest.Mock).mockReturnValue(mockAnchor);
      
      // Mock the current time for predictable filename
      const fixedDate = new Date('2024-01-15T10:30:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);
      
      await settingsService.saveSettingsWithFilePicker(false);

      expect(mockAnchor.download).toMatch(/^nova-journal-settings-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
