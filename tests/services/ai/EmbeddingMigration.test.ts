import { EmbeddingMigrationService } from '../../../services/ai/EmbeddingMigrationService';

jest.mock('../../../services/ai/EnhancedEmbeddingService', () => ({
  EnhancedEmbeddingService: jest.fn().mockImplementation(() => ({
    incrementalUpdateIndex: jest.fn().mockResolvedValue(undefined),
    fullRebuild: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('EmbeddingMigrationService', () => {
  let service: EmbeddingMigrationService;
  interface MockApp {
    vault: {
      getName(): string;
    };
  }

  interface MockSettings {
    promptStyle: 'reflective';
    insertLocation: 'cursor';
    addSectionHeading: boolean;
    sectionHeading: string;
    dailyNoteFolder: string;
    dailyNoteFormat: string;
    promptTemplate: string;
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
    defaultDeepenScope: 'line';
    aiMaxTokens: number;
    aiRetryCount: number;
    aiFallbackModel: string;
    typewriterSpeed: 'normal';
    buttonStyle: 'button';
    buttonPosition: 'bottom';
    moodButtonLabel: string;
    showMoodButton: boolean;
    buttonTheme: string;
  }

  let mockApp: MockApp;
  let mockSettings: MockSettings;

  beforeEach((): void => {
    mockApp = {
      vault: {
        getName: (): string => 'test-vault',
      },
    };

    mockSettings = {
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
      aiEnabled: true,
      aiApiKey: 'sk-test-key',
      aiModel: 'gpt-4o-mini',
      aiSystemPrompt: 'You are Nova, a reflective journaling companion.',
      deepenButtonLabel: 'Explore more',
      userName: 'You',
      aiDebug: false,
      defaultDeepenScope: 'line',
      aiMaxTokens: 800,
      aiRetryCount: 2,
      aiFallbackModel: '',
      typewriterSpeed: 'normal',
      buttonStyle: 'button',
      buttonPosition: 'bottom',
      moodButtonLabel: 'Analyze mood',
      showMoodButton: true,
      buttonTheme: 'default',
    };

    service = new EmbeddingMigrationService(mockApp as any, mockSettings);

    (localStorage.getItem as jest.Mock).mockClear();
    (localStorage.setItem as jest.Mock).mockClear();
    (localStorage.removeItem as jest.Mock).mockClear();
  });

  describe('checkMigrationNeeded', () => {
    test('should return true when legacy index exists but enhanced does not', async () => {
      (localStorage.getItem as jest.Mock)
        // legacy index
        .mockReturnValueOnce('{"items": []}')
        // enhanced index
        .mockReturnValueOnce(null);

      const result = await service.checkMigrationNeeded();

      expect(result).toBe(true);
      expect(localStorage.getItem).toHaveBeenCalledWith('nova-journal-index-test-vault');
      expect(localStorage.getItem).toHaveBeenCalledWith('nova-journal-enhanced-index-test-vault');
    });

    test('should return false when enhanced index already exists', async () => {
      (localStorage.getItem as jest.Mock)
        // legacy index
        .mockReturnValueOnce('{"items": []}')
        // enhanced index
        .mockReturnValueOnce('{"version": "2.0.0"}');

      const result = await service.checkMigrationNeeded();

      expect(result).toBe(false);
    });

    test('should return false when no legacy index exists', async () => {
      (localStorage.getItem as jest.Mock)
        // no legacy index
        .mockReturnValueOnce(null)
        // no enhanced index
        .mockReturnValueOnce(null);

      const result = await service.checkMigrationNeeded();

      expect(result).toBe(false);
    });

    test('should handle localStorage errors gracefully', async () => {
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = await service.checkMigrationNeeded();

      expect(result).toBe(false);
    });
  });

  describe('cleanupLegacyIndex', () => {
    test('should remove legacy index from localStorage', async () => {
      await service.cleanupLegacyIndex();

      expect(localStorage.removeItem).toHaveBeenCalledWith('nova-journal-index-test-vault');
    });

    test('should handle cleanup errors gracefully', async () => {
      (localStorage.removeItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      await expect(service.cleanupLegacyIndex()).resolves.toBeUndefined();
    });
  });

  describe('migrateToEnhancedSystem', () => {
    test('should perform backup and migration', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('{"items": []}');

      const result = await service.migrateToEnhancedSystem();

      expect(result).toBe(true);
    });

    test('should return false on migration failure', async () => {
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage failure');
      });

      const result = await service.migrateToEnhancedSystem();

      expect(result).toBe(false);
    });
  });
});
