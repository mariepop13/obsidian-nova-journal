import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { chat } from './ai/AiClient';
import { PromptService } from './prompt/PromptService';
import type { PromptStyle } from './prompt/PromptRegistry';
import { DEFAULT_SETTINGS, NovaJournalSettings, EnhancedInsertionLocation, normalizeSettings } from './settings/PluginSettings';
import { getDeepenSource, insertAtLocation, typewriterInsert, removeDateHeadingInEditor, generateAnchorId, removeAnchorsInBlock, insertAnchorBelow } from './services/NoteEditor';
import { NovaJournalSettingTab } from './ui/SettingsTab';
import { registerDeepenHandlers } from './ui/DeepenHandlers';

export default class NovaJournalPlugin extends Plugin {
    settings: NovaJournalSettings;
    private promptService: PromptService;

	async onload() {
		await this.loadSettings();
        this.promptService = new PromptService();
        this.addRibbonIcon('sparkles', 'Nova Journal: Insert today\'s prompt', async () => {
            await this.insertTodaysPrompt();
        });
        this.addRibbonIcon('gear', 'Nova Journal: Settings', async () => {
            const settings = (this.app as any).setting;
            if (settings?.open) settings.open();
            if (settings?.openTabById) settings.openTabById(this.manifest.id);
        });
        this.addCommand({
            id: 'nova-insert-todays-prompt',
            name: 'Nova Journal: Insert today\'s prompt',
            callback: async () => {
                await this.insertTodaysPrompt();
            },
        });
        this.addCommand({
            id: 'nova-open-settings',
            name: 'Nova Journal: Open settings',
            callback: async () => {
                const settings = (this.app as any).setting;
                if (settings?.open) settings.open();
                if (settings?.openTabById) settings.openTabById(this.manifest.id);
            },
        });
		this.addCommand({
            id: 'nova-insert-prompt-here',
            name: 'Nova Journal: Insert prompt here',
            callback: async () => {
                await this.insertPromptInActiveEditor();
            },
        });
		this.addCommand({
            id: 'nova-cycle-prompt-style',
            name: 'Nova Journal: Cycle prompt style',
            callback: async () => {
                this.cyclePromptStyle();
            },
        });
		this.addCommand({
            id: 'nova-deepen-last-line',
            name: 'Nova Journal: Deepen last line (AI)',
            callback: async () => {
                await this.deepenLastLine();
            },
        });
        this.addSettingTab(new NovaJournalSettingTab(this.app, this));

        registerDeepenHandlers(this, () => this.settings.deepenButtonLabel, (line) => this.deepenLastLine(line), (label) => this.deepenWholeNote(label));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        const normalized = normalizeSettings(this.settings);
        if (JSON.stringify(normalized) !== JSON.stringify(this.settings)) {
            this.settings = normalized;
            await this.saveSettings();
        }
    }

    private async deepenLastLine(targetLine?: number): Promise<void> {
        if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
            new Notice('Nova Journal: enable AI and set API key in settings.');
            return;
        }
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) { new Notice('Nova Journal: open a note.'); return; }
        const editor = view.editor;

        const source = getDeepenSource(editor, targetLine);
        if (!source) { new Notice('Nova Journal: no text to deepen.'); return; }
        const { text: lastLineText, line } = source;

        let buttonLine: number | null = null;

        if (typeof targetLine === 'number') {
            const pattern = new RegExp(`^<a[^>]*class=\\"nova-deepen\\"[^>]*data-line=\\"${line}\\"[^>]*>.*<\\/a>$`);
            for (let i = line + 1; i <= editor.lastLine(); i += 1) {
                const t = editor.getLine(i).trim();
                if (pattern.test(t)) { buttonLine = i; break; }
                if (/^[^\s].*:/.test(t)) break;
            }
            if (buttonLine == null) {
                const id = generateAnchorId();
                const newLine = insertAnchorBelow(editor, line, `data-line=\"${line}\"`, id, this.settings.deepenButtonLabel);
                buttonLine = newLine - 1;
            }
        } else {
            const header = `**${this.settings.userName || 'You'}** (you): ${lastLineText}`;
            const from = { line, ch: 0 };
            const to = { line, ch: editor.getLine(line).length };
            editor.replaceRange(header, from, to);
        }

        if (typeof targetLine === 'number') {
            try {
                const ai = await chat({
                    apiKey: this.settings.aiApiKey,
                    model: this.settings.aiModel,
                    systemPrompt: this.settings.aiSystemPrompt,
                    userText: lastLineText,
                    maxTokens: this.settings.aiMaxTokens,
                    debug: this.settings.aiDebug,
                    retryCount: this.settings.aiRetryCount,
                    fallbackModel: this.settings.aiFallbackModel,
                });
                const answerLine = buttonLine!;
                editor.replaceRange(`**Nova**: \n`, { line: answerLine, ch: 0 });
                await typewriterInsert(editor, answerLine, '**Nova**: ', ai, (this.settings as any).typewriterSpeed ?? 'normal');
            } catch (e) {
                console.error(e);
                new Notice('Nova Journal: AI request failed.');
            }
        } else {
            try {
                const ai = await chat({
                    apiKey: this.settings.aiApiKey,
                    model: this.settings.aiModel,
                    systemPrompt: this.settings.aiSystemPrompt,
                    userText: lastLineText,
                    maxTokens: this.settings.aiMaxTokens,
                    debug: this.settings.aiDebug,
                    retryCount: this.settings.aiRetryCount,
                    fallbackModel: this.settings.aiFallbackModel,
                });
                const linesCount = editor.lastLine();
                let anchorLine: number | null = null;
                const anchorRegex = /<a[^>]*class=\"nova-deepen\"[^>]*>/;
                for (let i = line + 1; i <= linesCount; i += 1) {
                    const t = editor.getLine(i);
                    if (anchorRegex.test(t)) { anchorLine = i; break; }
                    if (/^[^\s].*:/.test(t)) break;
                }
                const scopeAttr = this.settings.defaultDeepenScope === 'note' ? 'data-scope="note"' : `data-line="${line}"`;
                if (anchorLine !== null) {
                    editor.replaceRange(`**Nova**: \n`, { line: anchorLine, ch: 0 }, { line: anchorLine, ch: editor.getLine(anchorLine).length });
                    await typewriterInsert(editor, anchorLine, '**Nova**: ', ai, (this.settings as any).typewriterSpeed ?? 'normal');
                    removeAnchorsInBlock(editor, line);
                    const id = generateAnchorId();
                    insertAnchorBelow(editor, anchorLine, scopeAttr, id, this.settings.deepenButtonLabel);
                } else {
                    editor.replaceRange(`**Nova**: \n`, { line: line + 1, ch: 0 });
                    await typewriterInsert(editor, line + 1, '**Nova**: ', ai, (this.settings as any).typewriterSpeed ?? 'normal');
                    removeAnchorsInBlock(editor, line);
                    const id = generateAnchorId();
                    insertAnchorBelow(editor, line + 1, scopeAttr, id, this.settings.deepenButtonLabel);
                }
            } catch (e) {
                console.error(e);
                new Notice('Nova Journal: AI request failed.');
            }
        }
    }

    private async deepenWholeNote(label: string): Promise<void> {
        if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
            new Notice('Nova Journal: enable AI and set API key in settings.');
            return;
        }
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) { new Notice('Nova Journal: open a note.'); return; }
        const editor = view.editor;
        const content = editor.getValue();
        if (!content.trim()) { new Notice('Nova Journal: note is empty.'); return; }
        try {
            const system = `${this.settings.aiSystemPrompt}\nYou see the entire note context.`;
            const ai = await chat({
                apiKey: this.settings.aiApiKey,
                model: this.settings.aiModel,
                systemPrompt: system,
                userText: content,
                maxTokens: this.settings.aiMaxTokens,
                debug: this.settings.aiDebug,
                retryCount: this.settings.aiRetryCount,
                fallbackModel: this.settings.aiFallbackModel,
            });
            const linesCount = editor.lastLine();
            let anchorLine: number | null = null;
            for (let i = 0; i <= linesCount; i += 1) {
                const t = editor.getLine(i);
                if (/<a[^>]*class=\"nova-deepen\"[^>]*data-scope=\"note\"/.test(t)) { anchorLine = i; break; }
            }
            const namePrefix = `**${this.settings.userName || 'You'}** (you):`;
            let userLineIdx = (anchorLine !== null ? anchorLine - 1 : editor.lastLine());
            while (userLineIdx >= 0 && editor.getLine(userLineIdx).trim().length === 0) userLineIdx -= 1;
            if (userLineIdx >= 0) {
                const raw = editor.getLine(userLineIdx);
                const trimmed = raw.trim();
                if (trimmed && !trimmed.startsWith(namePrefix)) {
                    editor.replaceRange(`${namePrefix} ${trimmed}`, { line: userLineIdx, ch: 0 }, { line: userLineIdx, ch: raw.length });
                }
            }
            if (anchorLine !== null) {
                editor.replaceRange(`**Nova**: \n`, { line: anchorLine, ch: 0 }, { line: anchorLine, ch: editor.getLine(anchorLine).length });
                await typewriterInsert(editor, anchorLine, '**Nova**: ', ai, (this.settings as any).typewriterSpeed ?? 'normal');
                removeAnchorsInBlock(editor, anchorLine);
                const id = generateAnchorId();
                insertAnchorBelow(editor, anchorLine, 'data-scope="note"', id, label);
            } else {
                const to = { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length };
                const needsBreak = editor.getValue().trim().length > 0 ? '\n\n' : '';
                editor.replaceRange(`${needsBreak}**Nova**: \n`, to);
                const answerLine = editor.lastLine();
                await typewriterInsert(editor, answerLine, '**Nova**: ', ai, (this.settings as any).typewriterSpeed ?? 'normal');
                removeAnchorsInBlock(editor, answerLine);
                const id = generateAnchorId();
                insertAnchorBelow(editor, answerLine, 'data-scope="note"', id, label);
            }
        } catch (e) {
            console.error(e);
            new Notice('Nova Journal: AI request failed.');
        }
    }


	async saveSettings() {
		await this.saveData(this.settings);
	}

    private async insertTodaysPrompt(): Promise<void> {
        try {
            const todayFile = await this.ensureTodayNote();
            await this.openFileIfNotActive(todayFile);
            
            await this.removeDateHeadingIfPresent(todayFile);

            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) {
                new Notice('Nova Journal: could not find an active markdown editor.');
                return;
            }

            const editor = view.editor;
            removeDateHeadingInEditor(editor);
            const date = new Date();
            const basePrompt = this.promptService.getPromptForDate(this.settings.promptStyle as PromptStyle, date);

            // Check for duplicates and determine marker usage
            const byMarker = (this.settings as any).useDuplicateMarker !== false;
            
            if (this.settings.preventDuplicateForDay) {
                const noteText = editor.getValue();
                const todayMarker = `<!-- nova:prompt:${this.formatDate(date, 'YYYY-MM-DD')} -->`;
                
                if (byMarker) {
                    if (noteText.includes(todayMarker)) {
                        new Notice('Nova Journal: prompt for today already exists in this note.');
                        return;
                    }
                } else {
                    if (noteText.includes(basePrompt)) {
                        new Notice('Nova Journal: prompt for today already exists in this note.');
                        return;
                    }
                }
            }

            const prompt = this.renderFinalPrompt(basePrompt, date);
            insertAtLocation(editor, prompt, this.settings.insertLocation as any, (this.settings as any).insertHeadingName);
            
            // Add marker if using marker-based duplicate detection
            if (byMarker) {
                const marker = `\n<!-- nova:prompt:${this.formatDate(date, 'YYYY-MM-DD')} -->\n`;
                editor.replaceRange(marker, { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length });
            }
            new Notice('Nova Journal: prompt inserted.');
        } catch (error) {
            console.error('Nova Journal insert error', error);
            new Notice('Nova Journal: failed to insert prompt. See console for details.');
        }
    }

    private renderFinalPrompt(base: string, date: Date): string {
        const heading = this.settings.addSectionHeading && this.settings.sectionHeading
            ? `${this.settings.sectionHeading}\n\n`
            : '';

        const tpl = (this.settings.promptTemplate || '').trim();
        if (tpl.length > 0) {
            const rendered = this.renderTemplate(tpl, base, date);
            return `${heading}${rendered}\n`;
        }
        return `${heading}${base}\n`;
    }

    private renderTemplate(template: string, prompt: string, date: Date): string {
        let out = template.replace(/\{\{\s*prompt\s*\}\}/g, prompt);
        out = out.replace(/\{\{\s*date(?::([^}]+))?\s*\}\}/g, (_m, fmt) => {
            const f = typeof fmt === 'string' ? fmt.trim() : 'YYYY-MM-DD';
            return this.formatDate(date, f);
        });
        if (this.settings.aiEnabled) {
            const userLine = `**${this.settings.userName || 'You'}** (you): `;
            out = out.replace(/\{\{\s*user_line\s*\}\}/g, userLine);
        } else {
            out = out.replace(/\{\{\s*user_line\s*\}\}/g, '');
            out = out.replace(/^\s*\*\*Nova\*\*:\s*/gm, '');
            out = out.replace(/<a[^>]*class=\"nova-deepen\"[^>]*>.*?<\/a>\s*/g, '');
        }
        out = out.replace(/\n{3,}/g, '\n\n').trimEnd();
        return out;
    }

    private async insertPromptInActiveEditor(): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice('Nova Journal: open a markdown note to insert a prompt.');
            return;
        }
        const editor = view.editor;
        removeDateHeadingInEditor(editor);
        const date = new Date();
        const basePrompt = this.promptService.getPromptForDate(this.settings.promptStyle as PromptStyle, date);
        if (this.settings.preventDuplicateForDay) {
            const noteText = editor.getValue();
            if (noteText.includes(basePrompt)) {
                new Notice('Nova Journal: this prompt already exists in this note.');
                return;
            }
        }
        const prompt = this.renderFinalPrompt(basePrompt, date);
        insertAtLocation(editor, prompt, this.settings.insertLocation);
        new Notice('Nova Journal: prompt inserted.');
    }

    private cyclePromptStyle(): void {
        const order: PromptStyle[] = ['reflective', 'gratitude', 'planning'];
        const idx = order.indexOf(this.settings.promptStyle as PromptStyle);
        const safeIdx = idx >= 0 ? idx : 0;
        const next = order[(safeIdx + 1) % order.length];
        this.settings.promptStyle = next as PromptStyle;
        void this.saveSettings();
        new Notice(`Nova Journal: style set to ${next}`);
    }

    private insertAtLocation(editor: Editor, text: string, location: EnhancedInsertionLocation, belowHeadingName?: string): void {
        const ensureTrailingNewline = (s: string) => (s.endsWith('\n') ? s : s + '\n');
        const block = ensureTrailingNewline(text);

        if (location === 'top') {
            const current = editor.getValue();
            editor.setValue(`${block}${current.replace(/^\n+/, '')}`);
            return;
        }
        if (location === 'bottom') {
            const lastLine = editor.lastLine();
            const lastLineText = editor.getLine(lastLine);
            const needsLeadingBreak = lastLineText.trim().length > 0;
            const insertText = (needsLeadingBreak ? '\n\n' : '') + block;
            const to = { line: lastLine, ch: lastLineText.length };
            editor.replaceRange(insertText, to);
            return;
        }
        if (location === 'below-heading') {
            const target = (belowHeadingName || '').trim();
            const last = editor.lastLine();
            const headingRegex = target ? new RegExp(`^\s*#{1,6}\s*${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*$`) : null;
            for (let i = 0; i <= last; i += 1) {
                const txt = editor.getLine(i);
                const isMatch = headingRegex ? headingRegex.test(txt.trim()) : /^\s*#{1,6}\s*.+$/.test(txt.trim());
                if (isMatch) {
                    editor.replaceRange(`\n${block}`, { line: i + 1, ch: 0 });
                    return;
                }
            }
        }
        editor.replaceSelection(block);
    }

    private formatDate(date: Date, format: string): string {
        const yyyy = date.getFullYear().toString();
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        const HH = date.getHours().toString().padStart(2, '0');
        const Min = date.getMinutes().toString().padStart(2, '0');
        return format
            .replace(/YYYY/g, yyyy)
            .replace(/MM/g, mm)
            .replace(/DD/g, dd)
            .replace(/HH/g, HH)
            .replace(/mm/g, Min);
    }

    private async ensureTodayNote(): Promise<TFile> {
        const baseFolder = (this.settings.dailyNoteFolder ?? 'Journal').trim() || 'Journal';
        const now = new Date();
        const year = this.formatDate(now, 'YYYY');
        const month = this.formatDate(now, 'MM');
        const folderPath = (this.settings as any).organizeByYearMonth ? `${baseFolder}/${year}/${month}` : baseFolder;
        const fileName = `${this.formatDate(now, this.settings.dailyNoteFormat)}.md`;
        const filePath = `${folderPath}/${fileName}`;

        const parts = folderPath.split('/').filter(Boolean);
        let currentPath = '';
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const af = this.app.vault.getAbstractFileByPath(currentPath);
            if (!af) {
                await this.app.vault.createFolder(currentPath);
            }
        }

        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing instanceof TFile) {
            return existing;
        }
        const created = await this.app.vault.create(filePath, '');
        return created as TFile;
    }

    private async removeDateHeadingIfPresent(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);
            const dateHeadingRegex = /^#{1,6}\s*\d{4}-\d{2}-\d{2}\s*$/;
            const filtered: string[] = [];
            for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i];
                if (dateHeadingRegex.test(line.trim())) {
                    if (i + 1 < lines.length && lines[i + 1].trim() === '') {
                        i += 1;
                    }
                    continue;
                }
                filtered.push(line);
            }
            if (filtered.length !== lines.length) {
                await this.app.vault.modify(file, filtered.join('\n'));
            }
        } catch (e) {
            console.warn('Nova Journal: could not sanitize date heading', e);
        }
    }

    private async openFileIfNotActive(file: TFile): Promise<void> {
        const active = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (active?.file?.path === file.path) return;
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        this.app.workspace.revealLeaf(leaf);
	}
}
