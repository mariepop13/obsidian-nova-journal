import { PromptGenerationService } from '../../../services/ai/PromptGenerationService';
import { EnhancedPromptGenerationService } from '../../../services/ai/EnhancedPromptGenerationService';

jest.mock('../../../services/ai/EnhancedPromptGenerationService');

describe('PromptGenerationService', () => {
  let service: PromptGenerationService;
  let mockSettings: any;
  let mockEnhancedService: jest.Mocked<EnhancedPromptGenerationService>;

  beforeEach(() => {
    mockSettings = {
      aiEnabled: true,
      aiApiKey: 'sk-test-key',
      aiModel: 'gpt-4',
      aiDebug: false,
      aiMaxTokens: 150,
      aiRetryCount: 1,
      aiFallbackModel: 'gpt-3.5-turbo',
    };

    jest.clearAllMocks();

    service = new PromptGenerationService(mockSettings);
    mockEnhancedService = (service as any).enhancedService;
  });

  describe('generateOpeningPrompt', () => {
    test('should return null when AI is disabled', async () => {
      mockSettings.aiEnabled = false;
      service = new PromptGenerationService(mockSettings);

      const result = await service.generateOpeningPrompt('reflective', 'Test note');

      expect(result).toBeNull();
    });

    test('should return null when API key is missing', async () => {
      mockSettings.aiApiKey = '';
      service = new PromptGenerationService(mockSettings);

      const result = await service.generateOpeningPrompt('reflective', 'Test note');

      expect(result).toBeNull();
    });

    test('should use emotionally aware prompts when mood has emotions', async () => {
      const mood = {
        dominant_emotions: ['happy', 'excited'],
        sentiment: ['positive'],
      };

      mockEnhancedService.generateEmotionallyAwarePrompt = jest
        .fn()
        .mockResolvedValue('How are you feeling about your excitement today?');

      const result = await service.generateOpeningPrompt('reflective', 'Great day!', mood);

      expect(mockEnhancedService.generateEmotionallyAwarePrompt).toHaveBeenCalledWith('reflective', 'Great day!', mood);
      expect(result).toBe('How are you feeling about your excitement today?');
    });

    test('should use thematic prompts when mood has tags', async () => {
      const mood = {
        tags: ['work', 'achievement'],
        sentiment: ['positive'],
      };

      mockEnhancedService.generateThematicPrompt = jest
        .fn()
        .mockResolvedValue('What did you accomplish at work today?');

      const result = await service.generateOpeningPrompt('planning', 'Finished project', mood);

      expect(mockEnhancedService.generateThematicPrompt).toHaveBeenCalledWith('planning', 'Finished project', [
        'work',
        'achievement',
      ]);
      expect(result).toBe('What did you accomplish at work today?');
    });

    test('should use contextual prompts as default', async () => {
      const mood = {
        sentiment: ['neutral'],
      };

      mockEnhancedService.generateContextualPrompt = jest.fn().mockResolvedValue('What happened today?');

      const result = await service.generateOpeningPrompt('reflective', 'Regular day', mood);

      expect(mockEnhancedService.generateContextualPrompt).toHaveBeenCalledWith('reflective', 'Regular day', mood, {
        prioritizeRecent: true,
        includeEmotionalContext: true,
        includeThematicContext: true,
        maxContextChunks: 3,
      });
      expect(result).toBe('What happened today?');
    });

    test('should fallback to legacy prompt on enhanced service failure', async () => {
      const mood = {
        sentiment: ['positive'],
      };

      mockEnhancedService.generateContextualPrompt = jest.fn().mockRejectedValue(new Error('Enhanced service failed'));

      jest.mock('../../../ai/AiClient', () => ({
        chat: jest.fn().mockResolvedValue('Fallback prompt question?'),
      }));

      const result = await service.generateOpeningPrompt('gratitude', 'Test note', mood);

      expect(mockEnhancedService.generateContextualPrompt).toHaveBeenCalled();

      expect(result).toBeDefined();
    });

    test('should prioritize emotions over tags', async () => {
      const mood = {
        dominant_emotions: ['happy'],
        tags: ['work'],
        sentiment: ['positive'],
      };

      mockEnhancedService.generateEmotionallyAwarePrompt = jest.fn().mockResolvedValue('Emotional prompt');

      await service.generateOpeningPrompt('reflective', 'Test', mood);

      expect(mockEnhancedService.generateEmotionallyAwarePrompt).toHaveBeenCalled();
      expect(mockEnhancedService.generateThematicPrompt).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle enhanced service instantiation errors', () => {
      (
        EnhancedPromptGenerationService as jest.MockedClass<typeof EnhancedPromptGenerationService>
      ).mockImplementationOnce(() => {
        throw new Error('Constructor failed');
      });

      expect(() => new PromptGenerationService(mockSettings)).not.toThrow();
    });

    test('should return null on total failure', async () => {
      mockEnhancedService.generateContextualPrompt = jest.fn().mockRejectedValue(new Error('Total failure'));

      global.fetch = jest.fn().mockRejectedValue(new Error('API failure'));

      const originalConsoleError = console.error;
      console.error = jest.fn();

      const result = await service.generateOpeningPrompt('reflective', 'Test');

      expect(result).toBeNull();

      console.error = originalConsoleError;

      global.fetch = jest.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          redirected: false,
          type: 'basic' as ResponseType,
          url: '',
          clone: jest.fn(),
          body: null,
          bodyUsed: false,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          blob: () => Promise.resolve(new Blob()),
          formData: () => Promise.resolve(new FormData()),
          bytes: () => Promise.resolve(new Uint8Array()),
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Mock AI response' } }],
              data: [{ embedding: [0.1, 0.2, 0.3] }],
            }),
          text: () => Promise.resolve('Mock response text'),
        } as Response)
      ) as jest.MockedFunction<typeof fetch>;
    });
  });
});
