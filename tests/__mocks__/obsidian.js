// Mock implementation of Obsidian API for testing

class MockPlugin {
  constructor() {
    this.app = mockApp;
    this.manifest = { id: 'test-plugin' };
  }
  
  async loadData() { return {}; }
  async saveData(data) { return; }
  addCommand(command) { return; }
  addSettingTab(tab) { return; }
  registerView(type, viewCreator) { return; }
}

class MockTFile {
  constructor(path = 'test.md') {
    this.path = path;
    this.name = path.split('/').pop();
    this.basename = this.name.replace(/\.[^/.]+$/, "");
    this.extension = 'md';
  }
}

class MockNotice {
  constructor(message, timeout) {
    console.log(`Notice: ${message}`);
  }
}

class MockMarkdownView {
  constructor() {
    this.editor = new MockEditor();
  }
  
  getViewType() { return 'markdown'; }
}

class MockEditor {
  constructor() {
    this.content = '';
  }
  
  getValue() { return this.content; }
  setValue(content) { this.content = content; }
  getLine(line) { return this.content.split('\n')[line] || ''; }
  lineCount() { return this.content.split('\n').length; }
  replaceRange(replacement, from, to) { return; }
  getRange(from, to) { return ''; }
  getCursor() { return { line: 0, ch: 0 }; }
  setCursor(pos) { return; }
}

class MockPluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  
  display() { return; }
  hide() { return; }
}

// Mock requestUrl for API calls
const requestUrl = async (options) => {
  // Check if we're in a test that expects failure
  if (global._mockRequestUrlShouldFail) {
    throw new Error('API failure');
  }
  
  // Mock successful API response
  return {
    status: 200,
    text: JSON.stringify({
      choices: [{ message: { content: 'Mock AI response' } }]
    }),
    json: {
      choices: [{ message: { content: 'Mock AI response' } }]
    }
  };
};

const mockApp = {
  vault: {
    getName: () => 'test-vault',
    getFiles: () => [],
    read: async (file) => 'test content',
    write: async (file, content) => {},
    getAbstractFileByPath: (path) => new MockTFile(path),
    adapter: {
      exists: async (path) => true,
      read: async (path) => 'test content',
      write: async (path, content) => {}
    }
  },
  workspace: {
    getActiveViewOfType: (type) => type === 'markdown' ? new MockMarkdownView() : null,
    getActiveFile: () => new MockTFile(),
    openLinkText: async (link, path) => {}
  },
  metadataCache: {
    getFileCache: (file) => ({ frontmatter: {} }),
    on: (event, callback) => {}
  }
};

module.exports = {
  Plugin: MockPlugin,
  TFile: MockTFile,
  Notice: MockNotice,
  MarkdownView: MockMarkdownView,
  Editor: MockEditor,
  PluginSettingTab: MockPluginSettingTab,
  App: class MockApp {},
  Component: class MockComponent {},
  requestUrl: requestUrl,
  Setting: class MockSetting {
    constructor(containerEl) {
      this.containerEl = containerEl;
      return this;
    }
    setName(name) { return this; }
    setDesc(desc) { return this; }
    addText(callback) { 
      if (callback) callback({ setValue: () => {}, onChange: () => {} });
      return this; 
    }
    addToggle(callback) { 
      if (callback) callback({ setValue: () => {}, onChange: () => {} });
      return this; 
    }
    addDropdown(callback) { 
      if (callback) callback({ addOption: () => {}, setValue: () => {}, onChange: () => {} });
      return this; 
    }
  }
};
