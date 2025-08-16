import { Setting, DropdownComponent, TextAreaComponent } from "obsidian";
import { ToastSpinnerService } from "../../services/editor/ToastSpinnerService";
import { SettingsUtils } from "../SettingsUtils";
import type NovaJournalPlugin from "../../main";

export class PromptTemplateSettingsRenderer {
	private readonly plugin: NovaJournalPlugin;
	private readonly refreshCallback: () => void;

	constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
		this.plugin = plugin;
		this.refreshCallback = refreshCallback;
	}

	renderPromptStyleSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Daily prompt style")
			.setDesc("Select the style of the daily prompt.")
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOptions({
					reflective: "Reflective",
					gratitude: "Gratitude",
					planning: "Planning",
					dreams: "Dreams",
				});
				dropdown.setValue(this.plugin.settings.promptStyle);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.promptStyle = value as
							| "reflective"
							| "gratitude"
							| "planning";
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error("Failed to save prompt style");
					}
				});
			});
	}

	renderTemplateSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Prompt template")
			.setDesc(
				"Use variables like {{prompt}}, {{date}} or {{date:YYYY-MM-DD}}"
			)
			.addTextArea((textArea: TextAreaComponent) => {
				textArea
					.setPlaceholder("{{prompt}}")
					.setValue(this.plugin.settings.promptTemplate || "")
					.onChange(async (value) => {
						try {
							this.plugin.settings.promptTemplate = value;
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save template");
						}
					});
				textArea.inputEl.cols = 40;
				textArea.inputEl.rows = 4;
				textArea.inputEl.addEventListener("blur", () => {
					this.refreshCallback();
				});
			});

		this.renderTemplatePresetSection(containerEl);
		SettingsUtils.renderTemplatePreview(
			containerEl,
			this.plugin.settings.promptTemplate || "",
			this.plugin.settings.userName
		);
	}

	private renderTemplatePresetSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Template preset")
			.setDesc("Choose a conversation-friendly prompt template")
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOptions({
					minimal: "Minimal",
					conversation: "Conversation",
					dated: "With date",
					custom: "Custom",
				});

				const currentPreset = SettingsUtils.getCurrentTemplatePreset(
					this.plugin.settings.promptTemplate || ""
				);
				dropdown.setValue(currentPreset);

				if (currentPreset === "custom") {
					if (dropdown.selectEl) {
						dropdown.selectEl.disabled = true;
					}
				}

				dropdown.onChange(async (value) => {
					try {
						if (value !== "custom") {
							this.plugin.settings.promptTemplate =
								SettingsUtils.getTemplatePreset(value);
							await this.plugin.saveSettings();
							this.refreshCallback();
						}
					} catch (error) {
						ToastSpinnerService.error("Failed to save preset");
					}
				});
			});
	}
}
