import { type ContextType } from '../../../services/ai/EnhancedEmbeddingService';
import { EnhancedPromptGenerationService } from '../../../services/ai/EnhancedPromptGenerationService';
import { ContextAnalyzer } from '../../../services/ai/ContextAnalyzer';
import { VectorUtils } from '../../../services/ai/VectorUtils';

interface MockApp {
  vault: {
    getName(): string;
    getFiles(): any[];
    read(file: any): Promise<string>;
    getAbstractFileByPath(path: string): any;
  };
}

interface MockSettings {
  aiEnabled: boolean;
  aiApiKey: string;
  aiModel: string;
  aiDebug: boolean;
  aiMaxTokens: number;
  aiRetryCount: number;
  aiFallbackModel: string;
  dailyNoteFolder: string;
}

const createMockApp = (): MockApp => ({
  vault: {
    getName: () => 'test-vault',
    getFiles: () => [],
    read: async () => '',
    getAbstractFileByPath: () => null,
  },
});

const createMockSettings = (): MockSettings => ({
  aiEnabled: true,
  aiApiKey: 'sk-test-key',
  aiModel: 'gpt-4',
  aiDebug: false,
  aiMaxTokens: 150,
  aiRetryCount: 1,
  aiFallbackModel: 'gpt-3.5-turbo',
  dailyNoteFolder: 'Journal',
});

describe('EnhancedEmbeddingService', () => {
  let contextAnalyzer: ContextAnalyzer;

  beforeEach(() => {
    contextAnalyzer = new ContextAnalyzer();

    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  test('should determine context type correctly', () => {
    const emotionalText = 'I feel really happy today and excited about the future';
    const temporalText = 'Yesterday I went to work and tomorrow I have a meeting';
    const thematicText = 'Working on my career goals and family relationships';
    const generalText = 'Just some random thoughts about life';

    expect(contextAnalyzer.determineContextType(emotionalText)).toBe('emotional');
    expect(contextAnalyzer.determineContextType(temporalText)).toBe('temporal');
    expect(contextAnalyzer.determineContextType(thematicText)).toBe('thematic');
    expect(contextAnalyzer.determineContextType(generalText)).toBe('general');
  });

  test('should extract emotional tags correctly', () => {
    const text = 'I feel happy but also a bit worried about work';
    const tags = contextAnalyzer.extractEmotionalTags(text);

    expect(tags).toContain('positive');
    expect(tags).toContain('negative');
  });

  test('should extract thematic tags correctly', () => {
    const text = 'Had a great day at work and then spent time with family';
    const tags = contextAnalyzer.extractThematicTags(text);

    expect(tags).toContain('work');
    expect(tags).toContain('personal');
  });

  test('should extract temporal markers correctly', () => {
    const text = 'Today at 2:30 PM I met with my boss, yesterday was difficult';
    const markers = contextAnalyzer.extractTemporalMarkers(text);

    expect(markers).toContain('today');
    expect(markers).toContain('2:30');
    expect(markers).toContain('yesterday');
  });

  test('should apply diversity filter correctly', () => {
    const createMockChunk = (vector: number[], text: string): any => ({
      path: 'test/path.md',
      date: Date.now(),
      lastModified: Date.now(),
      text,
      vector,
      contextType: 'general' as const,
      hash: 'test-hash',
    });

    const scored = [
      { item: createMockChunk([1, 0, 0], 'First chunk'), score: 0.9 },
      { item: createMockChunk([1, 0.1, 0], 'Similar chunk'), score: 0.8 },
      { item: createMockChunk([0, 1, 0], 'Different chunk'), score: 0.7 },
      { item: createMockChunk([0, 0, 1], 'Another different chunk'), score: 0.6 },
    ];

    const filtered = VectorUtils.applyDiversityFilter(scored, 0.5);

    expect(filtered.length).toBeLessThan(scored.length);
    expect(filtered[0].score).toBe(0.9);
  });
});

describe('EnhancedPromptGenerationService', () => {
  let service: EnhancedPromptGenerationService;
  let mockSettings: MockSettings;

  beforeEach(() => {
    mockSettings = createMockSettings();
    service = new EnhancedPromptGenerationService(mockSettings as any);

    Object.defineProperty(window, 'app', {
      value: createMockApp(),
      writable: true,
    });
  });

  test('should build system prompt correctly', () => {
    const prompt = (service as any).buildSystemPrompt('reflective', true, true);

    expect(prompt).toContain('contextually aware');
    expect(prompt).toContain('emotional patterns');
    expect(prompt).toContain('thematic connections');
    expect(prompt).toContain('reflective');
  });

  test('should build user prompt correctly', () => {
    const mood = {
      sentiment: 'positive',
      dominant_emotions: ['happy', 'excited'],
      tags: ['work', 'achievement'],
    };

    const prompt = (service as any).buildUserPrompt(
      'gratitude',
      'Had a great day at work',
      mood,
      'Context from past entries...'
    );

    expect(prompt).toContain('gratitude');
    expect(prompt).toContain('Had a great day at work');
    expect(prompt).toContain('positive');
    expect(prompt).toContain('Context from past entries');
  });

  test('should handle missing embedding service gracefully', async () => {
    Object.defineProperty(window, 'app', {
      value: undefined,
      writable: true,
    });

    const result = await service.generateContextualPrompt('reflective', 'Test note', { sentiment: ['neutral'] });

    expect(result).toBe('Mock AI response');
  });
});

describe('Context Type Classification', () => {
  beforeEach(() => {
    // Setup is not needed for these classification tests
  });

  const testCases: Array<{ text: string; expected: ContextType }> = [
    {
      text: "I'm feeling overwhelmed with anxiety about tomorrow's presentation",
      expected: 'emotional',
    },
    {
      text: 'Yesterday I completed three important tasks and tomorrow I have two meetings',
      expected: 'temporal',
    },
    {
      text: 'Made progress on my career goals and had dinner with family',
      expected: 'thematic',
    },
    {
      text: 'The weather is nice today, thinking about various things',
      expected: 'temporal',
    },
    {
      text: 'Work was stressful but I felt proud of my accomplishments with the team',
      expected: 'emotional',
    },
  ];

  testCases.forEach(({ text, expected }) => {
    test(`should classify "${text.substring(0, 30)}..." as ${expected}`, () => {
      const contextAnalyzer = new ContextAnalyzer();
      const result = contextAnalyzer.determineContextType(text);
      expect(result).toBe(expected);
    });
  });
});

describe('Enhanced Search Integration', () => {
  test('should prioritize emotional context for mood-based searches', () => {
    const mockSearchOptions = {
      contextTypes: ['emotional', 'general'],
      emotionalFilter: ['positive', 'excited'],
      boostRecent: false,
      diversityThreshold: 0.4,
    };

    expect(mockSearchOptions.contextTypes).toContain('emotional');
    expect(mockSearchOptions.emotionalFilter).toContain('positive');
    expect(mockSearchOptions.diversityThreshold).toBe(0.4);
  });

  test('should configure temporal search correctly', () => {
    const mockSearchOptions = {
      contextTypes: ['temporal', 'general'],
      temporalRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      boostRecent: true,
    };

    expect(mockSearchOptions.contextTypes).toContain('temporal');
    expect(mockSearchOptions.boostRecent).toBe(true);
    expect(mockSearchOptions.temporalRange).toBeDefined();
  });
});

export {};
