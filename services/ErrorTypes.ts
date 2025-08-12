export class NovaJournalError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'NovaJournalError';
  }
}

export class AIServiceError extends NovaJournalError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message, 'AI_SERVICE_ERROR');
    this.name = 'AIServiceError';
  }
}

export class FileServiceError extends NovaJournalError {
  constructor(message: string, public readonly filePath?: string) {
    super(message, 'FILE_SERVICE_ERROR');
    this.name = 'FileServiceError';
  }
}

export class EditorNotFoundError extends NovaJournalError {
  constructor() {
    super('Nova Journal: open a note.', 'EDITOR_NOT_FOUND');
    this.name = 'EditorNotFoundError';
  }
}

export class AINotConfiguredError extends NovaJournalError {
  constructor() {
    super('Nova Journal: enable AI and set API key in settings.', 'AI_NOT_CONFIGURED');
    this.name = 'AINotConfiguredError';
  }
}

export class EmptyNoteError extends NovaJournalError {
  constructor() {
    super('Nova Journal: note is empty.', 'EMPTY_NOTE');
    this.name = 'EmptyNoteError';
  }
}

export class NoTextToDeepenError extends NovaJournalError {
  constructor() {
    super('Nova Journal: no text to deepen.', 'NO_TEXT_TO_DEEPEN');
    this.name = 'NoTextToDeepenError';
  }
}
