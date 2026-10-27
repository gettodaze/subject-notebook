import { App, MarkdownView, Notice, type TFile, type WorkspaceLeaf } from "obsidian";
import type { Settings } from "../settings/model";
import type { Project } from "../projects/model";
import { SwitchQueue } from "../core/serial";
import { LogService, moveToEnd } from "../logs/log-service";
import { ProjectLayout } from "./project-layout";
import * as files from "../projects/files";
import * as paths from "../projects/paths";
import { discoverProjects } from "../projects/discovery";
import { ensureBase } from "../tasks/base-service";
import { prepareProject } from "../projects/preparation";
import * as features from "../settings/features";
import { loadTemplate } from "../projects/templates";

export class ProjectSwitching {
  private readonly queue = new SwitchQueue();
  private switching = false;
  private disposed = false;

  constructor(
    private readonly app: App,
    readonly layout: ProjectLayout,
    private readonly logs: LogService,
    private readonly settings: () => Settings,
    private readonly commit: (project: Project | undefined) => void,
    private readonly busyChanged: () => void,
  ) {}

  get busy(): boolean {
    return this.switching;
  }
  dispose(): void {
    this.disposed = true;
    this.queue.cancel();
  }
  invalidate(): void {
    this.queue.cancel();
    this.layout.reset();
  }
  cancel(): void {
    this.queue.cancel();
  }

  async activate(project?: Project, forceRestore: boolean = false): Promise<void> {
    if (this.disposed) return;
    await this.queue.run(async (current) => {
      this.switching = true;
      this.busyChanged();
      try {
        await this.open(project, current, forceRestore);
      } finally {
        this.layout.capture();
        this.switching = false;
        this.busyChanged();
      }
    });
  }

  private async open(
    project: Project | undefined,
    current: () => boolean,
    forceRestore: boolean,
  ): Promise<void> {
    const settings = this.settings();
    const flags = project
      ? features.projectFeatures(settings, project.folderPath)
      : features.homeFeatures(settings);
    if (project) {
      if (!this.app.vault.getFolderByPath(project.folderPath))
        throw new Error("Project folder no longer exists.");
      await prepareProject(this.app.vault, project, settings);
    }
    if (!current()) return;
    if (!project && !flags.homepage && !flags.kanban && !this.layout.managed) {
      this.commit(undefined);
      return;
    }
    if (flags.kanban) await this.ensurePlanner();
    if (!current()) return;
    const leaves = await this.layout.prepare(current, flags, forceRestore);
    if (!leaves || !current()) return;
    if (project) await this.layout.openFiles(leaves, project, current);
    if (!current()) return;
    await this.layout.showPlanner(leaves, this.settings().projectsDir, project);
    if (!current()) return;
    let landingOpened = false;
    if (project && leaves.log.view instanceof MarkdownView && leaves.log.view.file) {
      await this.logs.ensureToday(leaves.log.view.file);
    } else if (!project) landingOpened = await this.tryOpenLanding(leaves.homepage);
    if (!current()) return;
    this.commit(project);
    this.focus(project, landingOpened);
  }

  private async tryOpenLanding(leaf?: WorkspaceLeaf): Promise<boolean> {
    try {
      return await this.openLanding(leaf);
    } catch (error: unknown) {
      new Notice(
        `Could not open Home landing note: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async openLanding(leaf?: WorkspaceLeaf): Promise<boolean> {
    const path = this.settings().homeLandingNote;
    if (!path || !leaf) return false;
    let file = this.app.vault.getFileByPath(path);
    if (!file && this.settings().homeLandingTemplate)
      file = await this.createLanding(path);
    if (!file) {
      new Notice(`Home landing note not found: ${path}. Showing the planner instead.`);
      return false;
    }
    await leaf.openFile(file, { active: false });
    if (paths.isProjectLogPath(file.path, this.settings().projectsDir)) {
      await this.logs.ensureToday(file);
      await leaf.loadIfDeferred();
      if (leaf.view instanceof MarkdownView && leaf.view.getMode() === "source")
        moveToEnd(leaf.view.editor, false);
    }
    return true;
  }

  private async createLanding(path: string): Promise<TFile> {
    const validated = paths.validateMarkdownPath(path);
    const content = await loadTemplate(
      this.app.vault,
      this.settings().homeLandingTemplate,
      { project: "Home", log: "", date: new Date() },
    );
    const separator = validated.lastIndexOf("/");
    if (separator > 0)
      await files.ensureFolder(this.app.vault, validated.slice(0, separator));
    return files.ensureFile(this.app.vault, validated, content);
  }

  private async ensurePlanner(): Promise<void> {
    const settings = this.settings();
    if (this.app.vault.getAbstractFileByPath(paths.basePath(settings.projectsDir)))
      return;
    await files.ensureFolder(this.app.vault, settings.projectsDir);
    await ensureBase(
      this.app.vault,
      settings.projectsDir,
      discoverProjects(this.app.vault, settings.projectsDir),
      settings.palettesByProjectPath,
    );
  }

  private focus(project: Project | undefined, landingOpened: boolean): void {
    const leaves = this.layout.managed;
    if (!leaves) return;
    if (project && leaves.log.view instanceof MarkdownView) {
      this.app.workspace.setActiveLeaf(leaves.log, { focus: true });
      moveToEnd(leaves.log.view.editor, true);
    } else if (landingOpened && leaves.homepage)
      this.app.workspace.setActiveLeaf(leaves.homepage, { focus: true });
    else if (leaves.planner)
      this.app.workspace.setActiveLeaf(leaves.planner, { focus: true });
  }
}
