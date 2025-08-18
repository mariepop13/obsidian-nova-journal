import { App } from 'obsidian';

export class SettingsCommandService {
  static openSettings(app: App, manifestId: string): void {
    const settings = (app as App & { setting?: any }).setting;
    if (!settings) return;

    if (settings.open) {
      settings.open();
    }

    if (settings.openTabById) {
      settings.openTabById(manifestId);
    }
  }
}
