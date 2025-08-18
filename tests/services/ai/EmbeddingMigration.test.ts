import { EmbeddingMigrationService } from '../../../services/ai/EmbeddingMigrationService';

jest.mock('../../../services/ai/EnhancedEmbeddingService', () => ({
  EnhancedEmbeddingService: jest.fn().mockImplementation(() => ({
    incrementalUpdateIndex: jest.fn().mockResolvedValue(undefined),
    fullRebuild: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('EmbeddingMigrationService', () => {
  let service: EmbeddingMigrationService;
  let mockApp: any;
  let mockSettings: any;

  beforeEach(() => {
    mockApp = {
      vault: {
        getName: () => 'test-vault',
      },
    };

    mockSettings = {
      aiEnabled: true,
      aiApiKey: 'sk-test-key',
      dailyNoteFolder: 'Journal',
    };

    service = new EmbeddingMigrationService(mockApp, mockSettings);

    (localStorage.getItem as jest.Mock).mockClear();
    (localStorage.setItem as jest.Mock).mockClear();
    (localStorage.removeItem as jest.Mock).mockClear();
  });

  describe('checkMigrationNeeded', () => {
    test('should return true when legacy index exists but enhanced does not', async () => {
      (localStorage.getItem as jest.Mock)
        .mockReturnValueOnce('{"items": []}') // legacy index
        .mockReturnValueOnce(null); // enhanced index

      const result = await service.checkMigrationNeeded();

      expect(result).toBe(true);
      expect(localStorage.getItem).toHaveBeenCalledWith('nova-journal-index-test-vault');
      expect(localStorage.getItem).toHaveBeenCalledWith('nova-journal-enhanced-index-test-vault');
    });

    test('should return false when enhanced index already exists', async () => {
      (localStorage.getItem as jest.Mock)
        .mockReturnValueOnce('{"items": []}') // legacy index
        .mockReturnValueOnce('{"version": "2.0.0"}'); // enhanced index

      const result = await service.checkMigrationNeeded();

      expect(result).toBe(false);
    });

    test('should return false when no legacy index exists', async () => {
      (localStorage.getItem as jest.Mock)
        .mockReturnValueOnce(null) // no legacy index
        .mockReturnValueOnce(null); // no enhanced index

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
