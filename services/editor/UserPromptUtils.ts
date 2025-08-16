import { Editor } from "obsidian";
import { isDeepenButtonMarkup, isMoodAnalyzeButtonMarkup } from "./ContentDetectionUtils";

export function ensureUserPromptLine(editor: Editor, userName: string): void {
	const namePrefix = createUserNamePrefix(userName);
	const buttonsLine = findButtonsLine(editor);

	if (buttonsLine !== null) {
		insertUserPromptAboveButtons(editor, buttonsLine, namePrefix);
	} else {
		insertUserPromptAtEnd(editor, namePrefix);
	}
}

function createUserNamePrefix(userName: string): string {
	return `**${userName || "You"}** (you):`;
}

function findButtonsLine(editor: Editor): number | null {
	const lastLine = editor.lastLine();

	for (let i = lastLine; i >= 0; i -= 1) {
		const text = editor.getLine(i).trim();
		if (isDeepenButtonMarkup(text) || isMoodAnalyzeButtonMarkup(text)) {
			return i;
		}
	}

	return null;
}

function insertUserPromptAboveButtons(
	editor: Editor,
	buttonsLine: number,
	namePrefix: string
): void {
	const lastNonEmptyAbove = findLastNonEmptyLineAbove(editor, buttonsLine);
	const from = { line: lastNonEmptyAbove + 1, ch: 0 };
	const to = { line: buttonsLine, ch: 0 };
	const block = `\n${namePrefix} \n\n`;

	const existingBetween = editor.getRange(from, to);
	if (existingBetween !== block) {
		editor.replaceRange(block, from, to);
	}
}

function findLastNonEmptyLineAbove(
	editor: Editor,
	buttonsLine: number
): number {
	for (let i = buttonsLine - 1; i >= 0; i -= 1) {
		if (editor.getLine(i).trim().length > 0) {
			return i;
		}
	}
	return -1;
}

function insertUserPromptAtEnd(editor: Editor, namePrefix: string): void {
	const lastLine = editor.lastLine();
	const lastText = editor.getLine(lastLine).trim();

	if (!lastText.startsWith(namePrefix)) {
		const to = { line: lastLine, ch: editor.getLine(lastLine).length };
		const block = `\n${namePrefix} \n`;
		editor.replaceRange(block, to);
	}
}
