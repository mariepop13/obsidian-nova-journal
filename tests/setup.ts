// Test setup file for Nova Journal plugin

// Mock Obsidian globals
const mockApp = {
  vault: {
    getName: () => 'test-vault',
    getFiles: () => [
      { path: 'Journal/test-file.md', name: 'test-file.md', extension: 'md' },
      { path: 'test-file2.md', name: 'test-file2.md', extension: 'md' }
    ],
    read: jest.fn(async () => 'Mock file content'),
    getAbstractFileByPath: jest.fn(() => null),
    getMarkdownFiles: () => [
      { path: 'Journal/test-file.md', name: 'test-file.md', extension: 'md' },
      { path: 'test-file2.md', name: 'test-file2.md', extension: 'md' }
    ],
    adapter: {
      exists: jest.fn(() => Promise.resolve(true)),
      read: jest.fn(() => Promise.resolve('Mock file content')),
      write: jest.fn(() => Promise.resolve()),
      list: jest.fn(() => Promise.resolve({ files: [], folders: [] }))
    }
  },
  workspace: {
    getActiveViewOfType: () => null,
    getActiveFile: () => null,
    getLeaf: () => ({
      openFile: jest.fn()
    })
  },
  metadataCache: {
    getFileCache: jest.fn(() => null),
    getCache: jest.fn(() => null)
  }
};

const mockPlugin = {
  app: mockApp,
  manifest: { id: 'nova-journal' },
  loadData: async () => ({}),
  saveData: async () => {}
};

// Global mocks
Object.defineProperty(global, 'window', {
  value: {
    app: mockApp
  },
  writable: true
});

// Mock localStorage with proper error handling
const mockLocalStorage = {
  getItem: jest.fn((key: string) => {
    if (key === 'nova-journal-embeddings') return JSON.stringify({});
    return null;
  }),
  setItem: jest.fn(),
  removeItem: jest.fn((key: string) => {
    if (key.includes('error')) {
      throw new Error('localStorage error');
    }
  }),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

Object.defineProperty(global, 'Storage', {
  value: jest.fn(() => mockLocalStorage),
  writable: true
});

// Obsidian module is mocked via moduleNameMapper in jest.config.js

// Mock fetch for API calls
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
    json: () => Promise.resolve({
      choices: [{ message: { content: 'Mock AI response' } }],
      data: [{ embedding: [0.1, 0.2, 0.3] }]
    }),
    text: () => Promise.resolve('Mock response text')
  } as Response)
) as jest.MockedFunction<typeof fetch>;

// Console override for cleaner test output
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (args[0]?.includes?.('test')) return;
  originalConsoleError(...args);
};

export {};
