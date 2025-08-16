import { Editor } from "obsidian";
import { TypewriterService } from "./TypewriterService";

// Re-exports from modular utilities
export { getDeepenSource } from "./SourceExtractionUtils";
export { insertAtLocation } from "./TextInsertionUtils";
export {
	generateAnchorId,
	isDeepenButtonMarkup,
	isMoodAnalyzeButtonMarkup,
	isNoteScopedDeepenMarkup
} from "./ContentDetectionUtils";
export {
	removeDateHeadingInEditor,
	removeAnchorsInBlock
} from "./ContentCleanupUtils";
export { ensureBottomButtons } from "./ButtonManagementUtils";
export { ensureUserPromptLine } from "./UserPromptUtils";

// Typewriter service wrapper for backward compatibility
export async function typewriterInsert(
	editor: Editor,
	line: number,
	prefix: string,
	text: string,
	speed: "slow" | "normal" | "fast" = "normal"
): Promise<void> {
	return TypewriterService.typewriterInsert({
		editor,
		line,
		prefix,
		text,
		speed,
	});
}
