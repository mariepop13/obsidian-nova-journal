import {
	Setting,
	TextComponent,
	DropdownComponent,
	ToggleComponent,
	TextAreaComponent,
} from "obsidian";
import {
	SettingsValidator,
	PromptPreset,
} from "../settings/PluginSettings";
import { ButtonCustomizationService } from "../services/editor/ButtonCustomizationService";
import { ToastSpinnerService } from "../services/editor/ToastSpinnerService";
import { ApiTester } from "../utils/ApiTester";
import { SettingsUtils } from "./SettingsUtils";
import type NovaJournalPlugin from "../main";

export class AISettingsRenderer {
	private readonly plugin: NovaJournalPlugin;
	private readonly refreshCallback: () => void;

	constructor(plugin: NovaJournalPlugin, refreshCallback: () => void) {
		this.plugin = plugin;
		this.refreshCallback = refreshCallback;
	}

	renderAIWarning(containerEl: HTMLElement): void {
		if (!this.plugin.settings.aiEnabled) {
			const template = this.plugin.settings.promptTemplate || "";
			if (SettingsUtils.hasAIExploreLinks(template)) {
				const warning = containerEl.createEl("div", {
					cls: "nova-settings-warning",
				});
				warning.setText(
					"Note: your Prompt template contains the Explore link, but AI is disabled. It will be removed from inserted content."
				);
			}
		}
	}

	renderAPIKeySection(containerEl: HTMLElement): void {
		const keyLooksValid = SettingsUtils.isValidOpenAIKey(
			this.plugin.settings.aiApiKey
		);

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc(
				keyLooksValid
					? "Stored locally. Only OpenAI is supported for now."
					: "Key format looks unusual. It should start with sk- for OpenAI."
			)
			.addText((text) => {
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.aiApiKey)
					.onChange(async (value) => {
						try {
							this.plugin.settings.aiApiKey = value;
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save API key");
						}
					});
				text.inputEl.addEventListener("blur", () => {
					this.refreshCallback();
				});
			})
			.addButton((button) =>
				button.setButtonText("Test").onClick(async () => {
					await ApiTester.testOpenAIConnection(
						this.plugin.settings.aiApiKey
					);
				})
			);
	}

	renderSystemPromptSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("System prompt")
			.addTextArea((textArea: TextAreaComponent) => {
				textArea
					.setValue(this.plugin.settings.aiSystemPrompt)
					.onChange(async (value) => {
						try {
							this.plugin.settings.aiSystemPrompt = value;
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save system prompt");
						}
					});
				textArea.inputEl.rows = 3;
			});
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

	renderTemplatePresetSection(containerEl: HTMLElement): void {
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

	renderModelSection(containerEl: HTMLElement): void {
		const modelLooksOpenAI = SettingsUtils.isValidOpenAIModel(
			this.plugin.settings.aiModel
		);

		new Setting(containerEl)
			.setName("OpenAI model")
			.setDesc(
				modelLooksOpenAI
					? "e.g., gpt-4o-mini. Only OpenAI models are supported for now."
					: "Model name may not be an OpenAI model (e.g., gpt-4o-mini)."
			)
			.addText((text) => {
				text
					.setPlaceholder("gpt-4o-mini")
					.setValue(this.plugin.settings.aiModel)
					.onChange(async (value) => {
						try {
							this.plugin.settings.aiModel =
								value || "gpt-4o-mini";
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save model");
						}
					});
				text.inputEl.addEventListener("blur", () => {
					this.refreshCallback();
				});
			});

		new Setting(containerEl)
			.setName("Fallback OpenAI model")
			.setDesc("Optional. Used if the primary OpenAI model fails.")
			.addText((text) =>
				text
					.setPlaceholder("gpt-4o-mini")
					.setValue(this.plugin.settings.aiFallbackModel || "")
					.onChange(async (value) => {
						try {
							this.plugin.settings.aiFallbackModel = value || "";
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save fallback model");
						}
					})
			);
	}

	renderUserInterfaceSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Typewriter speed")
			.setDesc("Controls the animation speed for AI responses")
			.addDropdown((dropdown: DropdownComponent) => {
				dropdown.addOptions({
					slow: "Slow",
					normal: "Normal",
					fast: "Fast",
				});
				dropdown.setValue(
					this.plugin.settings.typewriterSpeed || "normal"
				);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.typewriterSpeed =
							SettingsValidator.validateTypewriterSpeed(value);
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error("Failed to save typewriter speed");
					}
				});
			});

		new Setting(containerEl)
			.setName("Default deepen scope")
			.setDesc("What Explore more targets by default")
			.addDropdown((dropdown) => {
				dropdown.addOptions({
					line: "Current line",
					note: "Whole note",
				});
				dropdown.setValue(this.plugin.settings.defaultDeepenScope);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.defaultDeepenScope =
							SettingsValidator.validateDeepenScope(value);
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error("Failed to save deepen scope");
					}
				});
			});

		new Setting(containerEl)
			.setName("Explore link label")
			.setDesc('Shown under your last line, e.g., "Explore more"')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.deepenButtonLabel)
					.onChange(async (value) => {
						try {
							this.plugin.settings.deepenButtonLabel =
								value || "Explore more";
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save button label");
						}
					})
			);

		new Setting(containerEl)
			.setName("Your display name")
			.setDesc('Used in conversation blocks (e.g., "Name (you): …")')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.userName)
					.onChange(async (value) => {
						try {
							this.plugin.settings.userName = value || "You";
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save display name");
						}
					})
			);
	}

	renderButtonCustomizationSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Button Customization" });

		new Setting(containerEl)
			.setName("Button style")
			.setDesc("Visual style for deepen and mood analysis buttons")
			.addDropdown((dropdown) => {
				const styles = ButtonCustomizationService.getAvailableStyles();
				const options: Record<string, string> = {};
				styles.forEach((style) => (options[style.value] = style.label));

				dropdown.addOptions(options);
				dropdown.setValue(this.plugin.settings.buttonStyle);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.buttonStyle =
							SettingsValidator.validateButtonStyle(value);
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error("Failed to save button style");
					}
				});
			});

		new Setting(containerEl)
			.setName("Button position")
			.setDesc("Where buttons should appear in your notes")
			.addDropdown((dropdown) => {
				const positions =
					ButtonCustomizationService.getAvailablePositions();
				const options: Record<string, string> = {};
				positions.forEach((pos) => (options[pos.value] = pos.label));

				dropdown.addOptions(options);
				dropdown.setValue(this.plugin.settings.buttonPosition);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.buttonPosition =
							SettingsValidator.validateButtonPosition(value);
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error("Failed to save button position");
					}
				});
			});

		new Setting(containerEl)
			.setName("Button theme")
			.setDesc("Color theme for buttons")
			.addDropdown((dropdown) => {
				const themes = ButtonCustomizationService.getAvailableThemes();
				const options: Record<string, string> = {};
				themes.forEach((theme) => (options[theme.value] = theme.label));

				dropdown.addOptions(options);
				dropdown.setValue(this.plugin.settings.buttonTheme);
				dropdown.onChange(async (value) => {
					try {
						this.plugin.settings.buttonTheme = value;
						await this.plugin.saveSettings();
					} catch (error) {
						ToastSpinnerService.error("Failed to save button theme");
					}
				});
			});

		new Setting(containerEl)
			.setName("Mood button label")
			.setDesc("Text shown on the mood analysis button")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.moodButtonLabel)
					.onChange(async (value) => {
						try {
							this.plugin.settings.moodButtonLabel =
								value || "Analyze mood";
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save mood button label");
						}
					})
			);

		new Setting(containerEl)
			.setName("Show mood button")
			.setDesc(
				"Display the mood analysis button alongside deepen buttons"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showMoodButton)
					.onChange(async (value) => {
						try {
							this.plugin.settings.showMoodButton = value;
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save mood button setting");
						}
					})
			);
	}

	renderAdvancedSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Advanced" });

		new Setting(containerEl)
			.setName("Max tokens")
			.setDesc("Upper bound on AI response tokens")
			.addText((text) =>
				text
					.setPlaceholder("800")
					.setValue(String(this.plugin.settings.aiMaxTokens))
					.onChange(async (value) => {
						try {
							const tokenCount = Number(value);
							this.plugin.settings.aiMaxTokens =
								SettingsValidator.validateTokens(tokenCount);
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save max tokens");
						}
					})
			);

		new Setting(containerEl)
			.setName("Retry count")
			.setDesc("Number of retries on transient AI errors")
			.addText((text) =>
				text
					.setPlaceholder("2")
					.setValue(String(this.plugin.settings.aiRetryCount))
					.onChange(async (value) => {
						try {
							const retryCount = Number(value);
							this.plugin.settings.aiRetryCount =
								SettingsValidator.validateRetryCount(
									retryCount
								);
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save retry count");
						}
					})
			);
	}

	renderDebugSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Debug" });

		new Setting(containerEl)
			.setName("Enable AI debug logs")
			.setDesc("Show detailed logs in the console for RAG and AI operations")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.aiDebug)
					.onChange(async (value) => {
						try {
							this.plugin.settings.aiDebug = value;
							await this.plugin.saveSettings();
						} catch (error) {
							ToastSpinnerService.error("Failed to save debug setting");
						}
					})
			);
	}

	renderAISettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "AI (OpenAI only)" });

		new Setting(containerEl).setName("Enable AI").addToggle((toggle) =>
			toggle
				.setValue(this.plugin.settings.aiEnabled)
				.onChange(async (value) => {
					await SettingsUtils.saveSettingsWithErrorHandling(
						this.plugin,
						() => {
							this.plugin.settings.aiEnabled = value;
						},
						"Failed to save AI setting",
						true,
						this.refreshCallback
					);
				})
		);

		this.renderAIWarning(containerEl);

		if (this.plugin.settings.aiEnabled) {
			this.renderAPIKeySection(containerEl);
			this.renderSystemPromptSection(containerEl);
			this.renderPromptStyleSection(containerEl);
			this.renderTemplateSection(containerEl);
			this.renderModelSection(containerEl);
			this.renderUserInterfaceSection(containerEl);
			this.renderButtonCustomizationSection(containerEl);
			this.renderAdvancedSection(containerEl);
			this.renderDebugSection(containerEl);
		}
	}
}
