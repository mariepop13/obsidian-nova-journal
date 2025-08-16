import { RegexHelpers } from "../utils/RegexHelpers";

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
