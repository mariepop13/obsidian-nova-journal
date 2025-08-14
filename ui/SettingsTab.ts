import {
	App,
	PluginSettingTab,
	Setting,
	TextComponent,
	DropdownComponent,
	ToggleComponent,
	TextAreaComponent,
	Notice,
} from "obsidian";
import {
	DEFAULT_SETTINGS,
	TemplateFactory,
	DateFormatter,
	SettingsValidator,
	PromptPreset,
} from "../settings/PluginSettings";
import { ButtonCustomizationService } from "../services/editor/ButtonCustomizationService";
import { ApiTester } from "../utils/ApiTester";
import type NovaJournalPlugin from "../main";

export class NovaJournalSettingTab extends PluginSettingTab {
	private readonly plugin: NovaJournalPlugin;

	constructor(app: App, plugin: NovaJournalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private async saveSettingsWithErrorHandling(
		operation: () => Promise<void> | void,
		errorMessage: string,
		shouldRefresh = false
	): Promise<void> {
		try {
			await operation();
			await this.plugin.saveSettings();
			if (shouldRefresh) {
				this.display();
			}
		} catch (error) {
			console.error("Nova Journal settings error:", error);
			new Notice(errorMessage);
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Nova Journal Settings" });

		this.renderResetButton(containerEl);
		this.renderBasicSettings(containerEl);
		this.renderAISettings(containerEl);
	}

	private renderResetButton(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Reset to defaults")
			.setDesc("Restore all Nova Journal settings to factory defaults")
			.addButton((b) =>
				b.setButtonText("Reset").onClick(async () => {
					await this.saveSettingsWithErrorHandling(
						() => {
							this.plugin.settings = { ...DEFAULT_SETTINGS };
						},
						"Failed to reset settings",
						true
					);
				})
			);
	}

	private renderBasicSettings(containerEl: HTMLElement): void {
		this.renderInsertLocationSetting(containerEl);
		this.renderConditionalHeadingSetting(containerEl);
		this.renderSectionHeadingSetting(containerEl);
		this.renderDuplicatePreventionSettings(containerEl);
		this.renderDailyNoteSettings(containerEl);
	}

	private renderInsertLocationSetting(containerEl: HTMLElement): void {
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
					await this.saveSettingsWithErrorHandling(
						() => {
							this.plugin.settings.insertLocation = value as 'cursor' | 'top' | 'bottom' | 'below-heading';
						},
						"Failed to save insert location",
						true
					);
				});
			});
	}

	private renderConditionalHeadingSetting(containerEl: HTMLElement): void {
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
								new Notice("Failed to save heading name");
							}
						});
				});
		}
	}

	private renderSectionHeadingSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Add section heading")
			.setDesc('Insert a heading above the prompt (e.g., "## Prompt").')
			.addToggle((toggle: ToggleComponent) => {
				toggle.setValue(this.plugin.settings.addSectionHeading);
				toggle.onChange(async (value) => {
					await this.saveSettingsWithErrorHandling(
						() => {
							this.plugin.settings.addSectionHeading = value;
						},
						"Failed to save section heading setting",
						true
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
								new Notice(
									"Failed to save section heading text"
								);
							}
						});
				});
		}
	}

	private renderDuplicatePreventionSettings(containerEl: HTMLElement): void {
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
						this.display();
					} catch (error) {
						new Notice(
							"Failed to save duplicate prevention setting"
						);
					}
				});
			});

		// hidden marker logic removed; duplicates use content-based detection only
	}

	private renderDailyNoteSettings(containerEl: HTMLElement): void {
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
							new Notice("Failed to save folder setting");
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
						new Notice("Failed to save organization setting");
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
						this.display();
					} catch (error) {
						new Notice("Failed to save format setting");
					}
				});
			});

		const previewEl = containerEl.createEl("div", { cls: "nova-settings-preview" });
		const previewText = DateFormatter.getPreviewFilename(
			this.plugin.settings.dailyNoteFormat
		);
		previewEl.setText(`Example: ${previewText}`);
	}

	private renderAISettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "AI (OpenAI only)" });

		new Setting(containerEl).setName("Enable AI").addToggle((toggle) =>
			toggle
				.setValue(this.plugin.settings.aiEnabled)
				.onChange(async (value) => {
					await this.saveSettingsWithErrorHandling(
						() => {
							this.plugin.settings.aiEnabled = value;
						},
						"Failed to save AI setting",
						true
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

	private renderDebugSection(containerEl: HTMLElement): void {
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
							new Notice("Failed to save debug setting");
						}
					})
			);
	}

	private renderAIWarning(containerEl: HTMLElement): void {
		if (!this.plugin.settings.aiEnabled) {
			const template = this.plugin.settings.promptTemplate || "";
			if (/<a[^>]*class="nova-deepen"/i.test(template)) {
				const warning = containerEl.createEl("div", { cls: "nova-settings-warning" });
				warning.setText(
					"Note: your Prompt template contains the Explore link, but AI is disabled. It will be removed from inserted content."
				);
			}
		}
	}

	private renderAPIKeySection(containerEl: HTMLElement): void {
		const keyLooksValid = (this.plugin.settings.aiApiKey || "").startsWith(
			"sk-"
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
							new Notice("Failed to save API key");
						}
					});
				text.inputEl.addEventListener("blur", () => {
					this.display();
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

	private renderSystemPromptSection(containerEl: HTMLElement): void {
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
							new Notice("Failed to save system prompt");
						}
					});
				textArea.inputEl.rows = 3;
			});
	}

	private renderPromptStyleSection(containerEl: HTMLElement): void {
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
						this.plugin.settings.promptStyle = value as 'reflective' | 'gratitude' | 'planning';
						await this.plugin.saveSettings();
					} catch (error) {
						new Notice("Failed to save prompt style");
					}
				});
			});
	}

	private renderTemplateSection(containerEl: HTMLElement): void {
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
							new Notice("Failed to save template");
						}
					});
				textArea.inputEl.cols = 40;
				textArea.inputEl.rows = 4;
				textArea.inputEl.addEventListener("blur", () => {
					this.display();
				});
			});

		this.renderTemplatePresetSection(containerEl);
		this.renderTemplatePreview(containerEl);
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

				const currentPreset = TemplateFactory.getPresetType(
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
								TemplateFactory.getPreset(
									value as PromptPreset
								);
							await this.plugin.saveSettings();
							this.display();
						}
					} catch (error) {
						new Notice("Failed to save preset");
					}
				});
			});
	}

	private renderTemplatePreview(containerEl: HTMLElement): void {
		const preview = containerEl.createEl("div", { cls: "nova-settings-template-preview" });

		const now = new Date();
		const samplePrompt = "What are you grateful for today?";
		let output = (this.plugin.settings.promptTemplate || "").trim();

		output = output.replace(/\{\{\s*prompt\s*\}\}/g, samplePrompt);
		output = output.replace(
			/\{\{\s*user_line\s*\}\}/g,
			`**${this.plugin.settings.userName || "You"}** (you): `
		);
		output = output.replace(
			/\{\{\s*date(?::([^}]+))?\s*\}\}/g,
			(_match: string, format?: string) => {
				const dateFormat =
					typeof format === "string" ? format.trim() : "YYYY-MM-DD";
				return DateFormatter.format(now, dateFormat);
			}
		);

		preview.setText(output);
	}

	private renderModelSection(containerEl: HTMLElement): void {
		const modelLooksOpenAI = /^(gpt|o\d)/i.test(
			this.plugin.settings.aiModel || ""
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
							new Notice("Failed to save model");
						}
					});
				text.inputEl.addEventListener("blur", () => {
					this.display();
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
							new Notice("Failed to save fallback model");
						}
					})
			);
	}

	private renderUserInterfaceSection(containerEl: HTMLElement): void {
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
						new Notice("Failed to save typewriter speed");
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
						new Notice("Failed to save deepen scope");
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
							new Notice("Failed to save button label");
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
							new Notice("Failed to save display name");
						}
					})
			);
	}

	private renderButtonCustomizationSection(containerEl: HTMLElement): void {
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
						new Notice("Failed to save button style");
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
						new Notice("Failed to save button position");
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
						new Notice("Failed to save button theme");
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
							new Notice("Failed to save mood button label");
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
							new Notice("Failed to save mood button setting");
						}
					})
			);
	}

	private renderAdvancedSection(containerEl: HTMLElement): void {
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
							new Notice("Failed to save max tokens");
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
							new Notice("Failed to save retry count");
						}
					})
			);
	}
}
