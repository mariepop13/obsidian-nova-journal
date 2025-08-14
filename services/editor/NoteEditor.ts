import { Editor } from "obsidian";
import type { EnhancedInsertionLocation } from "../../settings/PluginSettings";
import { TypewriterService } from "./TypewriterService";
import { RegexHelpers } from "../utils/RegexHelpers";
import { ButtonCustomizationService } from "./ButtonCustomizationService";

export function getDeepenSource(
	editor: Editor,
	preferredLine?: number
): { text: string; line: number } | null {
	if (preferredLine !== undefined) {
		const t = editor.getLine(preferredLine)?.trim();
		if (t) return { text: t, line: preferredLine };
	}
	const sel = editor.getSelection()?.trim();
	if (sel) {
		const cursor = editor.getCursor();
		return { text: sel, line: cursor.line };
	}
	let line = editor.getCursor().line;
	while (line >= 0) {
		const txt = editor.getLine(line).trim();
		if (txt) return { text: txt, line };
		line -= 1;
	}
	return null;
}

export function insertAtLocation(
	editor: Editor,
	text: string,
	location: EnhancedInsertionLocation,
	belowHeadingName?: string
): void {
	const block = ensureTrailingNewline(text);

	switch (location) {
		case "top":
			insertAtTop(editor, block);
			break;
		case "bottom":
			insertAtBottom(editor, block);
			break;
		case "below-heading":
			insertBelowHeading(editor, block, belowHeadingName);
			break;
		default:
			editor.replaceSelection(block);
	}
}

function ensureTrailingNewline(text: string): string {
	return text.endsWith("\n") ? text : text + "\n";
}

function insertAtTop(editor: Editor, block: string): void {
	const current = editor.getValue();
	editor.setValue(`${block}${current.replace(/^\n+/, "")}`);
}

function insertAtBottom(editor: Editor, block: string): void {
	const lastLine = editor.lastLine();
	const lastLineText = editor.getLine(lastLine);
	const needsLeadingBreak = lastLineText.trim().length > 0;
	const insertText = (needsLeadingBreak ? "\n\n" : "") + block;
	const to = { line: lastLine, ch: lastLineText.length };
	editor.replaceRange(insertText, to);
}

function insertBelowHeading(
	editor: Editor,
	block: string,
	belowHeadingName?: string
): void {
	try {
		const insertLine = findHeadingInsertionLine(editor, belowHeadingName);

		if (insertLine < 0) {
			editor.replaceSelection(block);
			return;
		}

		insertAtHeadingPosition(editor, block, insertLine);
	} catch (regexError) {
		handleHeadingRegexError(editor, block, regexError);
	}
}

function findHeadingInsertionLine(
	editor: Editor,
	headingName?: string
): number {
	const target = (headingName || "").trim();
	const headingRegex = RegexHelpers.createHeadingRegex(target);
	const lastLine = editor.lastLine();
	let insertLine = -1;

	for (let i = 0; i <= lastLine; i += 1) {
		const lineText = editor.getLine(i);
		if (headingRegex.test(lineText.trim())) {
			insertLine = i + 1;
			if (target) break;
		}
	}

	return insertLine;
}

function insertAtHeadingPosition(
	editor: Editor,
	block: string,
	insertLine: number
): void {
	const insertPos = { line: insertLine, ch: 0 };
	const needsNewline =
		insertLine <= editor.lastLine() &&
		editor.getLine(insertLine).trim().length > 0;
	const insertText = needsNewline ? `${block}\n` : block;
	editor.replaceRange(insertText, insertPos);
}

function handleHeadingRegexError(
	editor: Editor,
	block: string,
	regexError: any
): void {
	console.warn(
		"Nova Journal: Invalid heading name for regex, falling back to cursor insertion",
		regexError
	);
	editor.replaceSelection(block);
}

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

export function removeDateHeadingInEditor(editor: Editor): void {
	const rangesToDelete = findDateHeadingRanges(editor);
	deleteRangesInReverse(editor, rangesToDelete);
}

function findDateHeadingRanges(editor: Editor): Array<{
	from: { line: number; ch: number };
	to: { line: number; ch: number };
}> {
	const ranges = [];
	const lastLine = editor.lastLine();

	for (let line = 0; line <= lastLine; line += 1) {
		const text = editor.getLine(line).trim();
		if (RegexHelpers.isDateHeading(text)) {
			const range = createDateHeadingRange(editor, line, lastLine);
			ranges.push(range);
		}
	}

	return ranges;
}

function createDateHeadingRange(
	editor: Editor,
	line: number,
	lastLine: number
) {
	const nextIsBlank =
		line + 1 <= lastLine && editor.getLine(line + 1).trim() === "";
	const from = { line, ch: 0 };
	const to = nextIsBlank
		? { line: line + 1, ch: editor.getLine(line + 1).length }
		: { line, ch: editor.getLine(line).length };
	return { from, to };
}

function deleteRangesInReverse(
	editor: Editor,
	ranges: Array<{ from: any; to: any }>
): void {
	for (let i = ranges.length - 1; i >= 0; i -= 1) {
		const range = ranges[i];
		editor.replaceRange("", range.from, range.to);
	}
}

export function generateAnchorId(): string {
	const rnd = Math.random().toString(36).slice(2, 8);
	return `conv-${Date.now().toString(36)}-${rnd}`;
}

export function isDeepenButtonMarkup(line: string): boolean {
	return RegexHelpers.isDeepenButtonMarkup(line);
}

export function isMoodAnalyzeButtonMarkup(line: string): boolean {
	return RegexHelpers.isMoodAnalyzeButtonMarkup(line);
}

export function isNoteScopedDeepenMarkup(line: string): boolean {
	return RegexHelpers.isNoteScopedDeepenMarkup(line);
}

export function removeAnchorsInBlock(editor: Editor, startLine: number): void {
	const blockEnd = findBlockEnd(editor, startLine);
	const anchorRanges = findAnchorRanges(editor, startLine, blockEnd);
	deleteRangesInReverse(editor, anchorRanges);
}

function findBlockEnd(editor: Editor, startLine: number): number {
	const lastLine = editor.lastLine();
	let end = startLine;
	let i = startLine + 1;

	for (; i <= lastLine; i += 1) {
		const text = editor.getLine(i);
		if (
			RegexHelpers.isBlankLine(text) ||
			RegexHelpers.isSpeakerLine(text)
		) {
			end = i - 1;
			break;
		}
		end = i;
	}

	for (; i <= lastLine; i += 1) {
		const text = editor.getLine(i);
		if (
			RegexHelpers.isSpeakerLine(text) ||
			!RegexHelpers.isBlankLine(text)
		) {
			break;
		}
		end = i;
	}

	return end;
}

function findAnchorRanges(
	editor: Editor,
	start: number,
	end: number
): Array<{ from: any; to: any }> {
	const ranges = [];

	for (let line = start; line <= end; line += 1) {
		const text = editor.getLine(line);
		if (RegexHelpers.isAnchorMarkup(text)) {
			ranges.push({
				from: { line, ch: 0 },
				to: { line, ch: text.length },
			});
		}
	}

	return ranges;
}

export function ensureBottomButtons(
	editor: Editor,
	label: string,
	settings?: any
): void {
	removeExistingButtons(editor);
	insertBottomButtons(editor, label, settings);
}

function removeExistingButtons(editor: Editor): void {
	const buttonRanges = findAllButtonRanges(editor);
	deleteRangesInReverse(editor, buttonRanges);
}

function findAllButtonRanges(editor: Editor): Array<{ from: any; to: any }> {
	const ranges = [];
	const lastLine = editor.lastLine();

	for (let i = 0; i <= lastLine; i += 1) {
		const text = editor.getLine(i);
		if (isDeepenButtonMarkup(text) || isMoodAnalyzeButtonMarkup(text)) {
			ranges.push({
				from: { line: i, ch: 0 },
				to: { line: i, ch: text.length },
			});
		}
	}

	return ranges;
}

function insertBottomButtons(
	editor: Editor,
	label: string,
	settings?: any
): void {
	const insertionPoint = findButtonInsertionPoint(editor);
	const buttons = createButtonMarkup(label, settings);
	editor.replaceRange(buttons, insertionPoint.from, insertionPoint.to);
}

function findButtonInsertionPoint(editor: Editor) {
	const endLine = editor.lastLine();
	const lastNonEmpty = findLastNonEmptyLine(editor, endLine);

	return {
		from: { line: lastNonEmpty + 1, ch: 0 },
		to: { line: endLine, ch: editor.getLine(endLine).length },
	};
}

function findLastNonEmptyLine(editor: Editor, endLine: number): number {
	for (let i = endLine; i >= 0; i -= 1) {
		if (editor.getLine(i).trim().length > 0) {
			return i;
		}
	}
	return -1;
}

function createButtonMarkup(label: string, settings?: any): string {
	if (settings) {
		try {
			const config =
				ButtonCustomizationService.createFromSettings(settings);
			config.scope = "note";
			const markup =
				ButtonCustomizationService.generateButtonMarkup(config);
			if (typeof markup === "string" && markup.length) return markup;
		} catch (e) {
		}
	}

	return `\n<button class="nova-deepen" data-scope="note">${label}</button> <button class="nova-mood-analyze">Analyze mood</button>\n`;
}

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
