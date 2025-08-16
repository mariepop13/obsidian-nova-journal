import { Editor } from "obsidian";

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
