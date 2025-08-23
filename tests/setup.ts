const mockApp = {
  vault: {
    getName: (): string => 'test-vault',
    getFiles: (): any[] => [
      { path: 'Journal/test-file.md', name: 'test-file.md', extension: 'md' },
      { path: 'test-file2.md', name: 'test-file2.md', extension: 'md' },
    ],
    read: jest.fn(async (): Promise<string> => 'Mock file content'),
    getAbstractFileByPath: jest.fn((): null => null),
    getMarkdownFiles: (): any[] => [
      { path: 'Journal/test-file.md', name: 'test-file.md', extension: 'md' },
      { path: 'test-file2.md', name: 'test-file2.md', extension: 'md' },
    ],
    adapter: {
      exists: jest.fn((): Promise<boolean> => Promise.resolve(true)),
      read: jest.fn((): Promise<string> => Promise.resolve('Mock file content')),
      write: jest.fn((): Promise<void> => Promise.resolve()),
      list: jest.fn((): Promise<{files: any[], folders: any[]}> => Promise.resolve({ files: [], folders: [] })),
    },
  },
  workspace: {
    getActiveViewOfType: (): null => null,
    getActiveFile: (): null => null,
    getLeaf: (): {openFile: jest.Mock} => ({
      openFile: jest.fn(),
    }),
  },
  metadataCache: {
    getFileCache: jest.fn((): null => null),
    getCache: jest.fn((): null => null),
  },
};

// mockPlugin is available if needed for specific tests
// const mockPlugin = {
//   app: mockApp,
//   manifest: { id: 'nova-journal' },
//   loadData: async () => ({}),
//   saveData: async () => {},
// };

Object.defineProperty(global, 'window', {
  value: {
    app: mockApp,
  },
  writable: true,
});

const mockLocalStorage = {
  getItem: jest.fn((key: string): string | null => {
    if (key === 'nova-journal-embeddings') return JSON.stringify({});
    return null;
  }),
  setItem: jest.fn(),
  removeItem: jest.fn((key: string): void => {
    if (key.includes('error')) {
      throw new Error('localStorage error');
    }
  }),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

Object.defineProperty(global, 'Storage', {
  value: jest.fn((): typeof mockLocalStorage => mockLocalStorage),
  writable: true,
});

global.fetch = jest.fn((_input: URL | RequestInfo, _init?: RequestInit) =>
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

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]): void => {
  const message = String(args[0] ?? '');

  if (
    message.includes('test') ||
    message.includes('Enhanced generation failed, falling back to legacy') ||
    message.includes('Enhanced service initialization failed') ||
    message.includes('Context gathering failed') ||
    message.includes('Migration failed') ||
    message.includes('Failed to backup legacy index') ||
    message.includes('Failed to cleanup legacy index') ||
    message.includes('Emotional prompt generation failed') ||
    message.includes('Thematic prompt generation failed') ||
    message.includes('Failed to gather contextual information')
  ) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]): void => {
  const message = String(args[0] ?? '');

  if (message.includes('test') || message.includes('Enhanced service initialization failed, will use legacy mode')) {
    return;
  }
  originalConsoleWarn(...args);
};

export {};
