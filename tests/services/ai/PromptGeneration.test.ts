import { PromptGenerationService } from '../../../services/ai/PromptGenerationService';
import { EnhancedPromptGenerationService } from '../../../services/ai/EnhancedPromptGenerationService';

jest.mock('../../../services/ai/EnhancedPromptGenerationService');

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

describe('PromptGenerationService', () => {
  let service: PromptGenerationService;
  let mockSettings: MockSettings;
  let mockEnhancedService: jest.Mocked<EnhancedPromptGenerationService>;

  beforeEach(() => {
    mockSettings = {
      promptStyle: 'reflective',
      insertLocation: 'cursor',
      addSectionHeading: true,
      sectionHeading: '## Journal Prompt',
      dailyNoteFolder: 'Marie/Journal',
      dailyNoteFormat: 'YYYY-MM-DD_HH-mm',
      promptTemplate: '**Nova**: {{prompt}}\n\n{{user_line}}',
      preventDuplicateForDay: true,
      insertHeadingName: '',
      organizeByYearMonth: false,
      aiEnabled: true,
      aiApiKey: 'sk-test-key',
      aiModel: 'gpt-4',
      aiSystemPrompt: 'You are Nova, a reflective journaling companion.',
      deepenButtonLabel: 'Explore more',
      userName: 'You',
      aiDebug: false,
      defaultDeepenScope: 'line',
      aiMaxTokens: 150,
      aiRetryCount: 1,
      aiFallbackModel: 'gpt-3.5-turbo',
      typewriterSpeed: 'normal',
      buttonStyle: 'button',
      buttonPosition: 'bottom',
      moodButtonLabel: 'Analyze mood',
      showMoodButton: true,
      buttonTheme: 'default',
    };

    jest.clearAllMocks();

    service = new PromptGenerationService(mockSettings as any);
    mockEnhancedService = (service as unknown as { enhancedService: jest.Mocked<EnhancedPromptGenerationService> }).enhancedService;
  });

  describe('generateOpeningPrompt', () => {
    test('should return null when AI is disabled', async () => {
      mockSettings.aiEnabled = false;
      service = new PromptGenerationService(mockSettings as any);

      const result = await service.generateOpeningPrompt('reflective', 'Test note');

      expect(result).toBeNull();
    });

    test('should return null when API key is missing', async () => {
      mockSettings.aiApiKey = '';
      service = new PromptGenerationService(mockSettings as any);

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

      const createService = () => new PromptGenerationService(mockSettings);
      expect(createService).not.toThrow();
    });

    test('should return null on total failure', async () => {
      mockEnhancedService.generateContextualPrompt = jest.fn().mockRejectedValue(new Error('Total failure'));

      global._mockRequestUrlShouldFail = true;

      const originalConsoleError = console.error;
      console.error = jest.fn();

      const result = await service.generateOpeningPrompt('reflective', 'Test');

      expect(result).toBeNull();

      console.error = originalConsoleError;
      global._mockRequestUrlShouldFail = false;

      const mockResponse = {
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
      } as Response;

      global.fetch = jest.fn((_input: URL | RequestInfo, _init?: RequestInit) => Promise.resolve(mockResponse)) as jest.MockedFunction<typeof fetch>;
    });
  });
});
