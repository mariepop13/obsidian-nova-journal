import { App } from 'obsidian';

interface AppWithSettings extends App {
  setting?: {
    open?(): void;
    openTabById?(tabId: string): void;
  };
}

export class SettingsCommandService {
  static openSettings(app: App, manifestId: string): void {
    const settings = (app as AppWithSettings).setting;
    if (!settings) return;

    if (settings.open) {
      settings.open();
    }

    if (settings.openTabById) {
      settings.openTabById(manifestId);
    }
  }
}
