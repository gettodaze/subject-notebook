import {
  Component,
  ItemView,
  MarkdownRenderer,
  TFile,
  type WorkspaceLeaf,
  type ViewStateResult,
} from "obsidian";
import type { Project } from "../projects/model";
import * as paths from "../projects/paths";
import * as config from "./base-config";
import * as tasks from "./model";
import { errorMessage } from "../ui/modals";
import { isRecord } from "../settings/model";

const UNSAFE_EMBED_NAME = /[\[\]#^\\\r\n]/u;

export class PlannerView extends ItemView {
  private rendering: Component | null = null;
  private generation = 0;
  private directory = paths.DEFAULT_DIRECTORY;
  private projectPath: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly setup: () => void,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return tasks.PLANNER_VIEW_TYPE;
  }
  override getDisplayText(): string {
    return "Project planner";
  }
  override getIcon(): string {
    return "kanban-square";
  }
  override async onClose(): Promise<void> {
    this.clear();
  }

  async refresh(): Promise<void> {
    await this.show(
      this.directory,
      this.projectPath ? paths.projectFromPath(this.projectPath) : undefined,
    );
  }

  override getState(): Record<string, unknown> {
    return { directory: this.directory, projectPath: this.projectPath };
  }

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    if (!isRecord(state) || typeof state.directory !== "string") return;
    const directory = paths.validateDirectory(state.directory);
    const project =
      typeof state.projectPath === "string" &&
      state.projectPath.slice(0, state.projectPath.lastIndexOf("/")) === directory
        ? paths.projectFromPath(state.projectPath)
        : undefined;
    await this.show(directory, project);
  }

  async show(directory: string, project?: Project): Promise<void> {
    this.clear();
    this.directory = directory;
    this.projectPath = project?.folderPath ?? null;
    const generation = this.generation;
    const path = paths.basePath(directory);
    const title = project ? tasks.projectViewName(project.name) : tasks.ALL_PROJECTS_VIEW;
    const target = this.contentEl.createDiv({ cls: "subject-notebook-planner-content" });
    this.addHelp();
    try {
      await this.renderBase(path, title, target, project);
      this.app.workspace.requestSaveLayout();
      if (generation !== this.generation) target.remove();
    } catch (error: unknown) {
      if (generation === this.generation) this.showFailure(errorMessage(error));
    }
  }

  private async renderBase(
    path: string,
    title: string,
    target: HTMLElement,
    project?: Project,
  ): Promise<void> {
    if (UNSAFE_EMBED_NAME.test(title)) {
      throw new Error(
        "Rename this project to remove Markdown link characters before embedding its planner.",
      );
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile))
      throw new Error(`Missing ${path}. Create a project to set up the planner.`);
    const content = await this.app.vault.read(file);
    if (!config.hasView(content, project))
      throw new Error(`Missing ${title} view in ${path}.`);
    if (!target.isConnected) return;
    const rendering = this.addChild(new Component());
    this.rendering = rendering;
    await MarkdownRenderer.render(
      this.app,
      `![[${path}#${title}]]`,
      target,
      path,
      rendering,
    );
  }

  private showFailure(message: string): void {
    this.clear();
    this.contentEl.createEl("p", { text: message });
    this.contentEl
      .createEl("button", { text: "Review planner setup" })
      .addEventListener("click", this.setup);
    this.contentEl.createEl("p", {
      text: "The planner requires Obsidian 1.14+ with Bases enabled in Settings → Core plugins.",
    });
  }

  private clear(): void {
    this.generation += 1;
    if (this.rendering) this.removeChild(this.rendering);
    this.rendering = null;
    this.contentEl.empty();
  }

  private addHelp(): void {
    const help = this.contentEl.createEl("details", {
      cls: "subject-notebook-planner-help",
    });
    help.createEl("summary", { text: "Planner help" });
    help.createEl("p", {
      text: "If the board is unavailable, enable Bases in Core plugins and use Obsidian 1.14 or later. Project notes and task commands work independently.",
    });
    help
      .createEl("button", { text: "Review planner setup" })
      .addEventListener("click", this.setup);
  }
}
