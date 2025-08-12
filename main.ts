import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { PromptService } from './prompt/PromptService';
import type { PromptStyle } from './prompt/PromptRegistry';
import { DEFAULT_SETTINGS, NovaJournalSettings, InsertionLocation } from './settings/PluginSettings';
import { NovaJournalSettingTab } from './ui/SettingsTab';

export default class NovaJournalPlugin extends Plugin {
    settings: NovaJournalSettings;
    private promptService: PromptService;

    async onload() {
        await this.loadSettings();
        this.promptService = new PromptService();
        this.addRibbonIcon('sparkles', 'Nova Journal: Insert today\'s prompt', async () => {
            await this.insertTodaysPrompt();
        });
        this.addCommand({
            id: 'nova-insert-todays-prompt',
            name: 'Nova Journal: Insert today\'s prompt',
            callback: async () => {
                await this.insertTodaysPrompt();
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

        this.registerMarkdownPostProcessor((el) => {
            el.querySelectorAll('a.nova-deepen').forEach((btn) => {
                btn.addEventListener('click', (evt) => {
                    evt.preventDefault();
                    const elBtn = btn as HTMLAnchorElement;
                    const lineAttr = elBtn.getAttribute('data-line');
                    const scope = elBtn.getAttribute('data-scope') || '';
                    const label = elBtn.textContent || this.settings.deepenButtonLabel;
                    const line = lineAttr ? Number(lineAttr) : undefined;
                    if (scope === 'note' || line === undefined) {
                        this.deepenWholeNote(label).catch(console.error);
                    } else {
                        this.deepenLastLine(line).catch(console.error);
                    }
                });
            });
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    private async deepenLastLine(targetLine?: number): Promise<void> {
        if (!this.settings.aiEnabled || !this.settings.aiApiKey) {
            new Notice('Nova Journal: enable AI and set API key in settings.');
            return;
        }
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) { new Notice('Nova Journal: open a note.'); return; }
        const editor = view.editor;

        const source = this.getDeepenSource(editor, targetLine);
        if (!source) { new Notice('Nova Journal: no text to deepen.'); return; }
        const { text: lastLineText, line } = source;

        let buttonLine: number | null = null;

        if (typeof targetLine === 'number') {
            const pattern = new RegExp(`^<button class=\\"nova-deepen\\" data-line=\\"${line}\\">.*<\\/button>$`);
            for (let i = line + 1; i <= editor.lastLine(); i += 1) {
                const t = editor.getLine(i).trim();
                if (pattern.test(t)) { buttonLine = i; break; }
                if (/^[^\s].*:/.test(t)) break;
            }
            if (buttonLine == null) {
                editor.replaceRange(`\n<a href=\"#\" class=\"nova-deepen\" data-line=\"${line}\">${this.settings.deepenButtonLabel}</a>\n`, { line: line + 1, ch: 0 });
                buttonLine = line + 2;
            }
        } else {
            const header = `${this.settings.userName || 'You'} (you): ${lastLineText}`;
            const from = { line, ch: 0 };
            const to = { line, ch: editor.getLine(line).length };
            editor.replaceRange(header, from, to);
        }

        if (typeof targetLine === 'number') {
            try {
                const ai = await this.callChatApi(this.settings.aiApiKey, this.settings.aiModel, this.settings.aiSystemPrompt, lastLineText);
                const answerPos = { line: buttonLine!, ch: 0 };
                editor.replaceRange(`Nova: ${ai}\n`, answerPos);
            } catch (e) {
                console.error(e);
                new Notice('Nova Journal: AI request failed.');
            }
        } else {
            try {
                const ai = await this.callChatApi(this.settings.aiApiKey, this.settings.aiModel, this.settings.aiSystemPrompt, lastLineText);
                const answerPos = { line: line + 1, ch: 0 };
            const scopeAttr = this.settings.defaultDeepenScope === 'note' ? 'data-scope=\\"note\\"' : `data-line=\\"${line}\\"`;
            const block = `Nova: ${ai}\n<a href=\"#\" class=\"nova-deepen\" ${scopeAttr}>${this.settings.deepenButtonLabel}</a>\n`;
                editor.replaceRange(block, answerPos);
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
            const ai = await this.callChatApi(this.settings.aiApiKey, this.settings.aiModel, system, content);
            const block = `Nova: ${ai}\n<button class=\"nova-deepen\" data-scope=\"note\">${label}</button>\n`;
            const to = { line: editor.lastLine(), ch: editor.getLine(editor.lastLine()).length };
            const needsBreak = editor.getValue().trim().length > 0 ? '\n\n' : '';
            editor.replaceRange(`${needsBreak}${block}`, to);
        } catch (e) {
            console.error(e);
            new Notice('Nova Journal: AI request failed.');
        }
    }
    private getDeepenSource(editor: Editor, preferredLine?: number): { text: string; line: number } | null {
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

    private async callChatApi(apiKey: string, model: string, systemPrompt: string, userText: string): Promise<string> {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model || 'gpt-5-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userText },
                ],
                max_completion_tokens: 512,
            }),
        });
        if (this.settings.aiDebug) {
            console.log('Nova AI status', resp.status, resp.statusText);
        }
        const data = await resp.json();
        if (this.settings.aiDebug) {
            console.log('Nova AI payload', data);
        }
        const choice = data?.choices?.[0];
        const msg = choice?.message;
        let text = '';
        if (typeof msg?.content === 'string') text = msg.content.trim();
        else if (Array.isArray(msg?.content)) text = msg.content.map((p: any) => (p?.text ?? '')).join('').trim();
        else if (typeof (msg as any)?.output_text === 'string') text = (msg as any).output_text.trim();
        return text;
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async insertTodaysPrompt(): Promise<void> {
        try {
            const todayFile = await this.ensureTodayNote();
            await this.openFileIfNotActive(todayFile);
            // Sanitize date headings to avoid redundancy in content
            await this.removeDateHeadingIfPresent(todayFile);

            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) {
                new Notice('Nova Journal: could not find an active markdown editor.');
                return;
            }

            const editor = view.editor;
            // Also sanitize in the live editor buffer in case other plugins injected a heading post-open
            this.removeDateHeadingInEditor(editor);
            const date = new Date();
            const basePrompt = this.promptService.getPromptForDate(this.settings.promptStyle as PromptStyle, date);

            if (this.settings.preventDuplicateForDay) {
                const noteText = editor.getValue();
                if (noteText.includes(basePrompt)) {
                    new Notice('Nova Journal: prompt for today already exists in this note.');
                    return;
                }
            }

            const prompt = this.renderFinalPrompt(basePrompt, date);
            this.insertAtLocation(editor, prompt, this.settings.insertLocation);
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
        // Support {{prompt}} and {{date}} with optional :FORMAT using YYYY, MM, DD
        let out = template.replace(/\{\{\s*prompt\s*\}\}/g, prompt);
        out = out.replace(/\{\{\s*date(?::([^}]+))?\s*\}\}/g, (_m, fmt) => {
            const f = typeof fmt === 'string' ? fmt.trim() : 'YYYY-MM-DD';
            return this.formatDate(date, f);
        });
        return out;
    }

    private async insertPromptInActiveEditor(): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice('Nova Journal: open a markdown note to insert a prompt.');
            return;
        }
        const editor = view.editor;
        this.removeDateHeadingInEditor(editor);
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
        this.insertAtLocation(editor, prompt, this.settings.insertLocation);
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

    private insertAtLocation(editor: Editor, text: string, location: InsertionLocation): void {
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
        editor.replaceSelection(block);
    }

    private formatDate(date: Date, format: string): string {
        const yyyy = date.getFullYear().toString();
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        return format
            .replace(/YYYY/g, yyyy)
            .replace(/MM/g, mm)
            .replace(/DD/g, dd);
    }

    private async ensureTodayNote(): Promise<TFile> {
        const folderPath = (this.settings.dailyNoteFolder ?? 'Journal').trim() || 'Journal';
        const fileName = `${this.formatDate(new Date(), this.settings.dailyNoteFormat)}.md`;
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
        const maybeHeader = this.settings.addDateHeading
            ? `# ${this.formatDate(new Date(), this.settings.dailyNoteFormat)}\n\n`
            : '';
        const created = await this.app.vault.create(filePath, maybeHeader);
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

    private removeDateHeadingInEditor(editor: Editor): void {
        try {
            const dateHeadingRegex = /^#{1,6}\s*\d{4}-\d{2}-\d{2}\s*$/;
            const last = editor.lastLine();
            const rangesToDelete: { from: { line: number; ch: number }; to: { line: number; ch: number } }[] = [];
            for (let line = 0; line <= last; line += 1) {
                const text = editor.getLine(line).trim();
                if (dateHeadingRegex.test(text)) {
                    const nextIsBlank = line + 1 <= last && editor.getLine(line + 1).trim() === '';
                    const from = { line, ch: 0 };
                    const to = nextIsBlank ? { line: line + 1, ch: editor.getLine(line + 1).length } : { line, ch: editor.getLine(line).length };
                    rangesToDelete.push({ from, to });
                }
            }
            for (let i = rangesToDelete.length - 1; i >= 0; i -= 1) {
                const r = rangesToDelete[i];
                editor.replaceRange('', r.from, r.to);
            }
        } catch (e) {
            console.warn('Nova Journal: could not sanitize date heading in editor', e);
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
