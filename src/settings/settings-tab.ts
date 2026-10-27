import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { Project } from "../projects/model";
import type { Settings } from "./model";
import * as paths from "../projects/paths";
import * as tasks from "../tasks/model";
import * as palettes from "../themes/palettes";
import * as issues from "../support/issues";
import * as features from "./features";
import { errorMessage } from "../ui/modals";

export interface SettingsActions {
  readonly settings: () => Settings;
  readonly projects: () => readonly Project[];
  readonly save: () => Promise<void>;
  readonly setupPlanner: () => void;
}

export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly actions: SettingsActions,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();
    this.addDirectory();
    this.addArchiveDirectory();
    this.addPreferences();
    this.addPalettes();
    this.addIssueRepository();
    new Setting(this.containerEl)
      .setName("Planner views")
      .setDesc(
        "Review missing views before changing an existing Tasks.base. Custom views are preserved.",
      )
      .addButton((button) =>
        button.setButtonText("Review setup").onClick(this.actions.setupPlanner),
      );
  }

  private save(): void {
    void this.actions.save().catch((error: unknown) => new Notice(errorMessage(error)));
  }

  private addIssueRepository(): void {
    new Setting(this.containerEl)
      .setName("GitHub issue repository")
      .setDesc(
        "Report Issue opens this repository's new-issue page. Use owner/repository or its GitHub URL.",
      )
      .addText((text) => {
        text
          .setValue(this.actions.settings().issueRepository)
          .setPlaceholder("owner/repository");
        text.inputEl.addEventListener("change", () => {
          try {
            const value = text.getValue().trim();
            if (value) issues.newIssueUrl(value);
            this.actions.settings().issueRepository = value;
            this.save();
          } catch (error: unknown) {
            new Notice(errorMessage(error));
          }
        });
      });
  }

  private addDirectory(): void {
    new Setting(this.containerEl)
      .setName("Projects directory")
      .setDesc("Vault-relative path. Changing this setting does not move existing notes.")
      .addText((text) => {
        text.setValue(this.actions.settings().projectsDir);
        text.inputEl.addEventListener("change", () => {
          try {
            const value = paths.validateDirectory(text.getValue());
            paths.validateSeparateDirectories(value, this.actions.settings().archiveDir);
            this.actions.settings().projectsDir = value;
            this.save();
          } catch (error: unknown) {
            new Notice(errorMessage(error));
          }
        });
      });
  }

  private addArchiveDirectory(): void {
    new Setting(this.containerEl)
      .setName("Archive directory")
      .setDesc("Separate from active projects. Archiving moves the whole folder here.")
      .addText((text) => {
        text.setValue(this.actions.settings().archiveDir);
        text.inputEl.addEventListener("change", () => {
          try {
            const value = paths.validateDirectory(text.getValue());
            paths.validateSeparateDirectories(this.actions.settings().projectsDir, value);
            this.actions.settings().archiveDir = value;
            this.save();
          } catch (error: unknown) {
            new Notice(errorMessage(error));
          }
        });
      });
  }

  private addPreferences(): void {
    const settings = this.actions.settings();
    new Setting(this.containerEl)
      .setName("Default task status")
      .addDropdown((dropdown) => {
        for (const status of tasks.STATUSES) dropdown.addOption(status, status);
        dropdown.setValue(settings.defaultTaskStatus).onChange((value) => {
          if (tasks.isTaskStatus(value)) {
            settings.defaultTaskStatus = value;
            this.save();
          }
        });
      });
    this.addToggle("Automatic daily headings", "automaticDailyHeadings");
    this.addToggle("Project styling", "projectStyling");
    this.addToggle("Status bar indicator", "showStatusBar");
    this.addToggle("Global Home: show homepage", "homeShowHomepage");
    this.addToggle("Global Home: show Kanban", "homeShowKanban");
    this.addPath(
      "Home landing note",
      "homeLandingNote",
      "Optional Markdown path. No note is forced when blank.",
    );
    this.addPath(
      "Project homepage template",
      "projectHomepageTemplate",
      "Optional Markdown template used only for missing project homepages. Tokens: {{project}}, {{log}}, {{date}}.",
    );
    this.addPath(
      "Home landing note template",
      "homeLandingTemplate",
      "Optional Markdown template used to create a missing configured Home note. Existing notes are preserved.",
    );
  }

  private addPath(
    name: string,
    key: "homeLandingNote" | "projectHomepageTemplate" | "homeLandingTemplate",
    description: string,
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.setValue(this.actions.settings()[key]);
        text.inputEl.addEventListener("change", () => {
          try {
            const value = text.getValue().trim();
            if (value) paths.validateMarkdownPath(value);
            this.actions.settings()[key] = value;
            this.save();
          } catch (error: unknown) {
            new Notice(errorMessage(error));
          }
        });
      });
  }

  private addToggle(
    name: string,
    key:
      | "automaticDailyHeadings"
      | "projectStyling"
      | "showStatusBar"
      | "homeShowHomepage"
      | "homeShowKanban",
  ): void {
    new Setting(this.containerEl).setName(name).addToggle((toggle) => {
      toggle.setValue(this.actions.settings()[key]).onChange((value) => {
        this.actions.settings()[key] = value;
        this.save();
      });
    });
  }

  private addPalettes(): void {
    this.containerEl.createEl("h3", { text: "Projects" });
    this.containerEl.createEl("p", {
      text: "Layout toggles apply on the next project switch or Restore project layout. Existing notes are kept. Both layout commands have unassigned hotkeys by default.",
    });
    for (const project of this.actions.projects()) {
      this.addPalette(project);
      this.addProjectFeature(project, "homepage", "Show homepage");
      this.addProjectFeature(project, "kanban", "Show Kanban");
    }
  }

  private addProjectFeature(
    project: Project,
    key: keyof features.ProjectFeatures,
    label: string,
  ): void {
    new Setting(this.containerEl)
      .setName(`${project.name}: ${label}`)
      .addToggle((toggle) => {
        toggle
          .setValue(
            features.projectFeatures(this.actions.settings(), project.folderPath)[key],
          )
          .onChange((value) => {
            const options = {
              ...features.projectFeatures(this.actions.settings(), project.folderPath),
              [key]: value,
            };
            Object.defineProperty(
              this.actions.settings().projectFeaturesByPath,
              project.folderPath,
              {
                value: options,
                enumerable: true,
                writable: true,
                configurable: true,
              },
            );
            this.save();
          });
      });
  }

  private addPalette(project: Project): void {
    const settings = this.actions.settings();
    const assignment = Object.hasOwn(settings.palettesByProjectPath, project.folderPath)
      ? settings.palettesByProjectPath[project.folderPath]
      : undefined;
    const palette = palettes.resolvePalette(project.name, assignment);
    new Setting(this.containerEl)
      .setName(
        features.isScratch(settings, project.folderPath)
          ? `${project.name} (scratch)`
          : project.name,
      )
      .setDesc(project.folderPath)
      .addDropdown((dropdown) => {
        for (const preset of palettes.PRESETS) dropdown.addOption(preset.id, preset.name);
        dropdown
          .addOption(palettes.CUSTOM_PALETTE_ID, "Custom color below")
          .setValue(palette.id)
          .onChange((value) =>
            this.setPalette(
              project,
              value === palettes.CUSTOM_PALETTE_ID ? palette.background : value,
            ),
          );
      })
      .addColorPicker((picker) =>
        picker.setValue(palette.background).onChange((value) => {
          this.setPalette(project, value);
        }),
      );
  }

  private setPalette(project: Project, value: string): void {
    Object.defineProperty(
      this.actions.settings().palettesByProjectPath,
      project.folderPath,
      {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      },
    );
    this.save();
  }
}
