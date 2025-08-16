import {
	Setting,
	TextComponent,
	DropdownComponent,
	ToggleComponent,
} from "obsidian";
import { ToastSpinnerService } from "../services/editor/ToastSpinnerService";
import { SettingsUtils } from "./SettingsUtils";
import type NovaJournalPlugin from "../main";

export class BasicSettingsRenderer {
	private readonly plugin: NovaJournalPlugin;
	private readonly refreshCallback: () => void;

	constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
		this.plugin = plugin;
		this.refreshCallback = refreshCallback;
	}

	renderInsertLocationSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Insert at")
			.setDesc("Where to insert the prompt in the daily note.")
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOptions({
					cursor: "Cursor",
					top: "Top",
					bottom: "Bottom",
					"below-heading": "Below heading",
				});
				dropdown.setValue(this.plugin.settings.insertLocation);
				dropdown.onChange(async (value) => {
					await SettingsUtils.saveSettingsWithErrorHandling(
						this.plugin,
						() => {
							this.plugin.settings.insertLocation = value as
								| "cursor"
								| "top"
								| "bottom"
								| "below-heading";
						},
						"Failed to save insert location",
						true,
						this.refreshCallback
					);
				});
			});
	}

	renderConditionalHeadingSetting(containerEl: HTMLElement): void {
		if (this.plugin.settings.insertLocation === "below-heading") {
			new Setting(containerEl)
				.setName("Heading name")
				.setDesc(
					"Insert right below this heading (exact text). If empty, inserts below the first heading."
				)
				.addText((text: TextComponent) => {
					text.setPlaceholder("## Journal")
						.setValue(this.plugin.settings.insertHeadingName || "")
						.onChange(async (value) => {
							try {
								this.plugin.settings.insertHeadingName = value;
								await this.plugin.saveSettings();
							} catch (error) {
								ToastSpinnerService.error("Failed to save heading name");
							}
						});
				});
		}
	}

	renderSectionHeadingSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Add section heading")
			.setDesc('Insert a heading above the prompt (e.g., "## Prompt").')
			.addToggle((toggle: ToggleComponent) => {
				toggle.setValue(this.plugin.settings.addSectionHeading);
				toggle.onChange(async (value) => {
					await SettingsUtils.saveSettingsWithErrorHandling(
						this.plugin,
						() => {
							this.plugin.settings.addSectionHeading = value;
						},
						"Failed to save section heading setting",
						true,
						this.refreshCallback
					);
				});
			});

		if (this.plugin.settings.addSectionHeading) {
			new Setting(containerEl)
				.setName("Section heading")
				.addText((text: TextComponent) => {
					text.setPlaceholder("## Prompt")
						.setValue(this.plugin.settings.sectionHeading)
						.onChange(async (value) => {
							try {
								this.plugin.settings.sectionHeading = value;
								await this.plugin.saveSettings();
							} catch (error) {
								ToastSpinnerService.error(
									"Failed to save section heading text"
								);
							}
						});
				});
		}
	}

	renderDuplicatePreventionSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Prevent duplicate prompt for today")
			.setDesc(
				"If enabled, the command will not insert a second prompt for the same date in this note."
			)
			.addToggle((toggle: ToggleComponent) => {
				toggle.setValue(this.plugin.settings.preventDuplicateForDay);
				toggle.onChange(async (value) => {
					try {
						this.plugin.settings.preventDuplicateForDay = value;
						await this.plugin.saveSettings();
						this.refreshCallback();
					} catch (error) {
						ToastSpinnerService.error(
							"Failed to save duplicate prevention setting"
						);
					}
				});
			});
	}

	renderDailyNoteSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Daily note folder")
			.setDesc("Folder path for daily notes (auto-created if missing).")
			.addText((text: TextComponent) => {
				text.setPlaceholder("Journal")
					.setValue(this.plugin.settings.dailyNoteFolder)
					.onChange(async (value) => {
						try {
							this.plugin.settings.dailyNoteFolder =
								value || "Journal";
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save folder setting");
						}
					});
			});

		new Setting(containerEl)
			.setName("Organize by year/month")
			.setDesc("Nest daily notes under YYYY/MM subfolders")
			.addToggle((toggle: ToggleComponent) => {
				toggle.setValue(
					this.plugin.settings.organizeByYearMonth || false
				);
				toggle.onChange(async (value) => {
					try {
						this.plugin.settings.organizeByYearMonth = value;
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error(
							"Failed to save organization setting"
						);
					}
				});
			});

		new Setting(containerEl)
			.setName("Daily note file format")
			.setDesc("Filename format for daily notes")
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOptions({
					"YYYY-MM-DD": "YYYY-MM-DD",
					"YYYY-MM-DD_HH-mm": "YYYY-MM-DD_HH-mm",
				});
				dropdown.setValue(this.plugin.settings.dailyNoteFormat);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.dailyNoteFormat =
							value || "YYYY-MM-DD";
						await this.plugin.saveSettings();
						this.refreshCallback();
					} catch (error) {
						ToastSpinnerService.error("Failed to save format setting");
					}
				});
			});

		SettingsUtils.renderDateFormatPreview(
			containerEl,
			this.plugin.settings.dailyNoteFormat
		);
	}

	renderBasicSettings(containerEl: HTMLElement): void {
		this.renderInsertLocationSetting(containerEl);
		this.renderConditionalHeadingSetting(containerEl);
		this.renderSectionHeadingSetting(containerEl);
		this.renderDuplicatePreventionSettings(containerEl);
		this.renderDailyNoteSettings(containerEl);
	}
}
