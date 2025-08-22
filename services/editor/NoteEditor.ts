import { Editor } from 'obsidian';
import { TypewriterService } from './TypewriterService';

export interface TypewriterInsertConfig {
  editor: Editor;
  line: number;
  prefix: string;
  text: string;
  speed?: 'slow' | 'normal' | 'fast';
}

// Re-exports from modular utilities
export { getDeepenSource } from './SourceExtractionUtils';
export { insertAtLocation } from './TextInsertionUtils';
export {
  generateAnchorId,
  isDeepenButtonMarkup,
  isMoodAnalyzeButtonMarkup,
  isNoteScopedDeepenMarkup,
} from './ContentDetectionUtils';
export { removeDateHeadingInEditor, removeAnchorsInBlock } from './ContentCleanupUtils';
export { ensureBottomButtons } from './ButtonManagementUtils';
export { ensureUserPromptLine } from './UserPromptUtils';

// Typewriter service wrapper for backward compatibility
export async function typewriterInsert(config: TypewriterInsertConfig): Promise<void> {
  const { editor, line, prefix, text, speed = 'normal' } = config;
  return TypewriterService.typewriterInsert({
    editor,
    line,
    prefix,
    text,
    speed,
  });
}
