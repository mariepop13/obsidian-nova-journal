import { App, MarkdownView, TFile } from 'obsidian';
import { DateFormatter } from '../../settings/PluginSettings';
import { logger } from '../shared/LoggingService';

export class FileService {
  constructor(private readonly app: App) {}

  async ensureTodayNote(
    dailyNoteFolder: string,
    dailyNoteFormat: string,
    organizeByYearMonth: boolean
  ): Promise<TFile> {
    const baseFolder = (dailyNoteFolder ?? 'Journal').trim() || 'Journal';
    const now = new Date();

    const folderPath = organizeByYearMonth ? this.buildYearMonthPath(baseFolder, now) : baseFolder;

    const fileName = `${DateFormatter.format(now, dailyNoteFormat)}.md`;
    const filePath = `${folderPath}/${fileName}`;

    await this.ensureFolderExists(folderPath);
    return await this.getOrCreateFile(filePath);
  }

  async openFileIfNotActive(file: TFile): Promise<void> {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active?.file?.path === file.path) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }

  async removeDateHeadingFromFile(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const lines = content.split(/\r?\n/);
      const dateHeadingRegex = /^#{1,6}\s*\d{4}-\d{2}-\d{2}\s*$/;

      const filtered = this.filterDateHeadings(lines, dateHeadingRegex);

      if (filtered.length !== lines.length) {
        await this.app.vault.modify(file, filtered.join('\n'));
      }
    } catch (error) {
      logger.error(`Failed to remove date heading from file ${file.path}: ${error.message}`, 'FileService');
    }
  }

  private buildYearMonthPath(baseFolder: string, date: Date): string {
    const year = DateFormatter.format(date, 'YYYY');
    const month = DateFormatter.format(date, 'MM');
    return `${baseFolder}/${year}/${month}`;
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const parts = folderPath.split('/').filter(Boolean);
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const abstractFile = this.app.vault.getAbstractFileByPath(currentPath);

      if (!abstractFile) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }

  private async getOrCreateFile(filePath: string): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(filePath);

    if (existing instanceof TFile) {
      return existing;
    }

    return await this.app.vault.create(filePath, '');
  }

  private filterDateHeadings(lines: string[], dateHeadingRegex: RegExp): string[] {
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

    return filtered;
  }
}
