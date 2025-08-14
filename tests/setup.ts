// Test setup file for Nova Journal plugin

// Mock Obsidian globals
const mockApp = {
  vault: {
    getName: () => 'test-vault',
    getFiles: () => [],
    read: async () => '',
    getAbstractFileByPath: () => null
  },
  workspace: {
    getActiveViewOfType: () => null
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

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
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
