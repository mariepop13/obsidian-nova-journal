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
    this.plugin.addCommand({
      id: 'nova-insert-todays-prompt',
      name: "Insert today's prompt",
      callback: async () => {
        await this.callbacks.insertTodaysPrompt();
      },
    });

    this.plugin.addCommand({
      id: 'nova-open-settings',
      name: 'Open settings',
      callback: async () => {
        SettingsCommandService.openSettings(this.plugin.app, this.plugin.manifest.id);
      },
    });

    this.plugin.addCommand({
      id: 'nova-insert-prompt-here',
      name: 'Insert prompt here',
      callback: async () => {
        await this.callbacks.insertPromptInActiveEditor();
      },
    });

    this.plugin.addCommand({
      id: 'nova-cycle-prompt-style',
      name: 'Cycle prompt style',
      callback: async () => {
        this.callbacks.cyclePromptStyle();
      },
    });

    this.plugin.addCommand({
      id: 'nova-deepen-last-line',
      name: 'Deepen last line (AI)',
      callback: async () => {
        await this.callbacks.deepenLastLine();
      },
    });

    this.plugin.addCommand({
      id: 'nova-rebuild-embeddings',
      name: 'Rebuild embeddings index',
      callback: async () => {
        await this.callbacks.rebuildEmbeddings();
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
