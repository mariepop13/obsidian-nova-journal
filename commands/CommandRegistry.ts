import type { Plugin } from 'obsidian';

import { SettingsCommandService } from '../services/utils/SettingsCommandService';
import { registerDeepenHandlers } from '../ui/DeepenHandlers';

export interface CommandCallbacks {
  insertTodaysPrompt: () => Promise<void>;
  insertPromptInActiveEditor: () => Promise<void>;
  cyclePromptStyle: () => void;
  deepenLastLine: (targetLine?: number) => Promise<void>;
  deepenWholeNote: (label: string) => Promise<void>;
  analyzeMood: () => Promise<void>;
  rebuildEmbeddings: () => Promise<void>;
  getDeepButtonLabel: () => string;
}

export class CommandRegistry {
  constructor(
    private plugin: Plugin,
    private callbacks: CommandCallbacks
  ) {}

  registerAllCommands(): void {
    this.registerRibbonIcons();
    this.registerCommands();
    this.registerDeepenHandlers();
  }

  private registerRibbonIcons(): void {
    this.plugin.addRibbonIcon('sparkles', "Nova Journal: Insert today's prompt", async () => {
      await this.callbacks.insertTodaysPrompt();
    });

    this.plugin.addRibbonIcon('gear', 'Nova Journal: Settings', async () => {
      SettingsCommandService.openSettings(this.plugin.app, this.plugin.manifest.id);
    });
  }

  private registerCommands(): void {
    this.addCommand('nova-insert-todays-prompt', "Insert today's prompt", () => 
      this.callbacks.insertTodaysPrompt()
    );

    this.addCommand('nova-open-settings', 'Open settings', () => 
      SettingsCommandService.openSettings(this.plugin.app, this.plugin.manifest.id)
    );

    this.addCommand('nova-insert-prompt-here', 'Insert prompt here', () => 
      this.callbacks.insertPromptInActiveEditor()
    );

    this.addCommand('nova-cycle-prompt-style', 'Cycle prompt style', () => 
      this.callbacks.cyclePromptStyle()
    );

    this.addCommand('nova-deepen-last-line', 'Deepen last line (AI)', () => 
      this.callbacks.deepenLastLine()
    );

    this.addCommand('nova-rebuild-embeddings', 'Rebuild embeddings index', () => 
      this.callbacks.rebuildEmbeddings()
    );
  }

  private addCommand(id: string, name: string, callback: () => void | Promise<void>): void {
    this.plugin.addCommand({
      id,
      name,
      callback: async () => {
        await callback();
      },
    });
  }

  private registerDeepenHandlers(): void {
    registerDeepenHandlers(
      this.plugin,
      this.callbacks.getDeepButtonLabel,
      this.callbacks.deepenLastLine,
      this.callbacks.deepenWholeNote,
      this.callbacks.analyzeMood
    );
  }
}
