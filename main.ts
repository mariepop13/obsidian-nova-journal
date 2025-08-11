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
        this.addSettingTab(new NovaJournalSettingTab(this.app, this));
	}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

    private insertAtLocation(editor: Editor, text: string, location: InsertionLocation): void {
        if (location === 'top') {
            const current = editor.getValue();
            editor.setValue(`${text}\n${current}`);
            return;
        }
        if (location === 'bottom') {
            editor.setCursor(editor.lastLine());
            editor.replaceRange(`\n\n${text}`, { line: editor.lastLine(), ch: Number.MAX_SAFE_INTEGER });
            return;
        }
        // cursor
        editor.replaceSelection(text);
    }

    private formatDate(date: Date, format: string): string {
        // Minimal token support: YYYY, MM, DD with separators
        const yyyy = date.getFullYear().toString();
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        return format
            .replace(/YYYY/g, yyyy)
            .replace(/MM/g, mm)
            .replace(/DD/g, dd);
    }

    private async ensureTodayNote(): Promise<TFile> {
        const folderPath = this.settings.dailyNoteFolder?.trim() || 'Journal';
        const fileName = `${this.formatDate(new Date(), this.settings.dailyNoteFormat)}.md`;
        const filePath = `${folderPath}/${fileName}`;

        // Ensure folder exists
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }

        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing instanceof TFile) {
            return existing;
        }
        const maybeHeader = this.settings.addDateHeading
            ? `# ${this.formatDate(new Date(), this.settings.dailyNoteFormat)}\n\n`
            : '';
        const file = await this.app.vault.create(filePath, maybeHeader);
        return file as TFile;
    }

    private async removeDateHeadingIfPresent(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const lines = content.split(/\r?\n/);
            // Remove date heading lines like '#2025-08-11' or '## 2025-08-11' wherever they appear
            const dateHeadingRegex = /^#{1,6}\s*\d{4}-\d{2}-\d{2}\s*$/;
            const filtered: string[] = [];
            for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i];
                if (dateHeadingRegex.test(line.trim())) {
                    // skip this line; also skip one following blank line if present
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
            // Delete from bottom to top so line indices remain valid
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
