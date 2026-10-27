import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  TFolder,
  type TAbstractFile,
} from "obsidian";
import { FileQueue } from "./core/serial";
import * as issues from "./support/issues";
import * as settingsModel from "./settings/model";
import * as features from "./settings/features";
import * as projectState from "./settings/project-state";
import { SettingsTab } from "./settings/settings-tab";
import type { Project } from "./projects/model";
import * as discovery from "./projects/discovery";
import { notebookForFile } from "./projects/notebooks";
import * as paths from "./projects/paths";
import * as files from "./projects/files";
import { prepareProject } from "./projects/preparation";
import { loadTemplate } from "./projects/templates";
import * as scratch from "./projects/scratch";
import { ProjectLifecycle } from "./projects/lifecycle-actions";
import * as baseService from "./tasks/base-service";
import * as tasks from "./tasks/model";
import { createNote } from "./tasks/task-files";
import { PlannerView } from "./tasks/planner-view";
import * as palettes from "./themes/palettes";
import { ProjectStyles } from "./themes/project-styles";
import { LogService, moveToEnd } from "./logs/log-service";
import { ProjectLayout } from "./workspace/project-layout";
import { ProjectSwitching } from "./workspace/switch-project";
import { emptyManagedEditor } from "./workspace/log-fallback";
import { registerCommands } from "./ui/commands";
import * as mainIndicator from "./ui/main-indicator";
import { ProjectSwitcher, NameModal, chooseAction, errorMessage } from "./ui/modals";

export class PluginRuntime {
  settings = settingsModel.defaultSettings();
  private projects: Project[] = [];
  private mainNotebookPath: string | null = null;
  private readonly styles = new ProjectStyles();
  private readonly writes = new FileQueue();
  private readonly logs: LogService;
  private readonly switching: ProjectSwitching;
  private readonly lifecycle: ProjectLifecycle;
  private status: HTMLElement | null = null;
  private disposed = false;
  private ready = false;
  private fallbackPending = false;
  private restoringLog = false;
  private lastLogView: MarkdownView | null = null;
  private lastLogFile: TFile | null = null;
  private discoveryDirectory = paths.DEFAULT_DIRECTORY;

  constructor(private readonly plugin: Plugin) {
    const app = plugin.app;
    this.logs = new LogService(
      app.vault,
      app.workspace,
      () => this.settings.automaticDailyHeadings,
      () => new Date(),
    );
    this.switching = new ProjectSwitching(
      app,
      new ProjectLayout(app),
      this.logs,
      () => this.settings,
      (project) => this.commit(project),
      () => {
        if (!this.disposed) this.updateStatus(this.mainNotebook());
      },
    );
    this.lifecycle = new ProjectLifecycle(app, {
      settings: (): settingsModel.Settings => this.settings,
      projects: (): readonly Project[] => this.projects,
      selectProject: (projects, choose): void => this.selectProject(projects, choose),
      completed: (source, target, movedPath): Promise<void> =>
        this.completeLifecycle(source, target, movedPath),
    });
  }

  async load(): Promise<void> {
    this.settings = settingsModel.parseSettings(await this.plugin.loadData());
    this.discoveryDirectory = this.settings.projectsDir;
    this.registerInterface();
    this.registerEvents();
    this.plugin.app.workspace.onLayoutReady(() => {
      if (this.disposed) return;
      this.ready = true;
      this.refreshProjects();
      this.adoptRestoredContext();
      this.updateAppearance();
      this.handleActiveLog();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.switching.dispose();
    this.logs.dispose();
    this.lifecycle.dispose();
    this.styles.clear();
    this.status?.remove();
    this.plugin.app.workspace.detachLeavesOfType(tasks.PLANNER_VIEW_TYPE);
  }

  private run(operation: () => Promise<void>): void {
    if (this.disposed) return;
    void operation().catch((error: unknown) => {
      if (!this.disposed) new Notice(errorMessage(error));
    });
  }

  private registerInterface(): void {
    this.plugin.registerView(
      tasks.PLANNER_VIEW_TYPE,
      (leaf) => new PlannerView(leaf, () => this.run(() => this.setupPlanner())),
    );
    registerCommands(this.plugin, {
      newProject: () => this.newProject(),
      switchProject: () => this.showSwitcher(),
      openHome: () => this.run(() => this.switching.activate()),
      newNote: () => this.newNote(false),
      newTask: () => this.newNote(true),
      openLog: () => this.withProject((project) => this.openProjectFile(project, true)),
      openHomepage: () =>
        this.withProject((project) => this.openProjectFile(project, false)),
      reportIssue: () => this.reportIssue(),
      newScratch: () => this.newProject(true),
      restoreLayout: () => this.restoreLayout(),
      combineProject: () =>
        this.withProject(async (project) => this.lifecycle.combine(project)),
      archiveProject: () =>
        this.withProject(async (project) => this.lifecycle.archive(project)),
      trashScratch: () => this.trashScratch(),
      useCurrentNotebook: () => this.useCurrentNotebook(),
    });
    this.plugin.addSettingTab(
      new SettingsTab(this.plugin.app, this.plugin, {
        settings: (): settingsModel.Settings => this.settings,
        projects: (): readonly Project[] => this.projects,
        save: (): Promise<void> => this.save(),
        setupPlanner: (): void => this.run(() => this.setupPlanner()),
      }),
    );
  }

  private registerEvents(): void {
    const { vault, workspace } = this.plugin.app;
    const changed = (file: TAbstractFile): void => this.onVaultChange(file.path);
    this.plugin.registerEvent(vault.on("create", changed));
    this.plugin.registerEvent(vault.on("delete", changed));
    this.plugin.registerEvent(
      vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)),
    );
    this.plugin.registerEvent(workspace.on("file-open", () => this.handleNavigation()));
    this.plugin.registerEvent(
      workspace.on("active-leaf-change", () => this.handleNavigation()),
    );
    this.plugin.registerEvent(
      workspace.on("layout-change", () => this.scheduleFallback()),
    );
  }

  private mainNotebook(): Project | undefined {
    return this.projects.find((project) => project.folderPath === this.mainNotebookPath);
  }

  private adoptRestoredContext(): void {
    let projectPath = this.settings.lastProjectPath;
    const planners = this.plugin.app.workspace.getLeavesOfType(tasks.PLANNER_VIEW_TYPE);
    if (projectPath === undefined && planners.length === 1) {
      const state: unknown = planners[0]?.getViewState().state;
      if (settingsModel.isRecord(state) && typeof state.projectPath === "string")
        projectPath = state.projectPath;
    }
    const project = this.projects.find(
      (candidate) => candidate.folderPath === projectPath,
    );
    this.mainNotebookPath = project?.folderPath ?? null;
    if (project) this.switching.layout.adopt(project);
  }

  private palette(project: Project): palettes.Palette {
    const assignments = this.settings.palettesByProjectPath;
    return palettes.resolvePalette(
      project.name,
      Object.hasOwn(assignments, project.folderPath)
        ? assignments[project.folderPath]
        : undefined,
    );
  }

  private commit(project?: Project): void {
    this.mainNotebookPath = project?.folderPath ?? null;
    if (this.settings.lastProjectPath !== this.mainNotebookPath) {
      this.settings.lastProjectPath = this.mainNotebookPath;
      this.run(() => this.persist());
    }
    this.updateAppearance();
  }

  private updateAppearance(): void {
    const project = this.mainNotebook();
    if (this.settings.projectStyling)
      this.styles.apply(this.plugin.app.workspace, (notebook) => this.palette(notebook));
    else this.styles.clear();
    this.updateStatus(project);
  }

  private updateStatus(project?: Project): void {
    if (!this.settings.showStatusBar) {
      this.status?.hide();
      return;
    }
    this.status ??= mainIndicator.createIndicator(this.plugin, () => this.showSwitcher());
    const label = project
      ? `Main notebook: ${project.name}${this.annotation(project)}`
      : "Subject Notebook: Home";
    const palette =
      project && this.settings.projectStyling ? this.palette(project) : undefined;
    mainIndicator.updateIndicator(this.status, label, this.switching.busy, palette);
  }

  private refreshProjects(): void {
    this.projects = discovery.discoverProjects(
      this.plugin.app.vault,
      this.settings.projectsDir,
    );
    const archived = discovery.discoverProjects(
      this.plugin.app.vault,
      this.settings.archiveDir,
    );
    this.styles.setNotebooks([...this.projects, ...archived]);
    if (this.mainNotebookPath && !this.mainNotebook()) this.commit();
  }

  private onVaultChange(path: string): void {
    if (
      !this.ready ||
      ![this.settings.projectsDir, this.settings.archiveDir].some((directory) =>
        discovery.affectsDiscovery(path, directory),
      )
    )
      return;
    this.refreshProjects();
    this.updateAppearance();
  }

  private onRename(file: TAbstractFile, oldPath: string): void {
    const previous = this.projects.find((project) => project.folderPath === oldPath);
    const known =
      Object.hasOwn(this.settings.palettesByProjectPath, oldPath) ||
      features.isScratch(this.settings, oldPath);
    if (file instanceof TFolder && (previous || known)) {
      this.switching.cancel();
      this.movePreferences(
        oldPath,
        file.path,
        this.palette(previous ?? paths.projectFromPath(oldPath)),
      );
      if (this.mainNotebookPath === oldPath) {
        this.mainNotebookPath = file.path;
        this.settings.lastProjectPath = file.path;
      }
      if (previous && discovery.affectsDiscovery(file.path, this.settings.projectsDir))
        new Notice(
          "Project renamed. Task project properties, homepage names, and planner views are preserved; review them before using the renamed planner.",
          10000,
        );
    }
    this.onVaultChange(oldPath);
    this.onVaultChange(file.path);
    this.switching.layout.renamed(oldPath, file.path);
  }

  private movePreferences(
    oldPath: string,
    newPath: string,
    previous: palettes.Palette,
  ): void {
    const fallback =
      previous.id === palettes.CUSTOM_PALETTE_ID ? previous.background : previous.id;
    projectState.moveProjectPreferences(this.settings, oldPath, newPath, fallback);
    this.run(() => this.save());
  }

  private async persist(): Promise<void> {
    await this.writes.run("settings", () => this.plugin.saveData(this.settings));
  }

  private async save(): Promise<void> {
    if (this.discoveryDirectory !== this.settings.projectsDir) {
      this.switching.invalidate();
      this.mainNotebookPath = null;
      this.settings.lastProjectPath = null;
      this.discoveryDirectory = this.settings.projectsDir;
    }
    await this.persist();
    if (this.disposed) return;
    this.refreshProjects();
    this.updateAppearance();
  }

  private showSwitcher(): void {
    new ProjectSwitcher(
      this.plugin.app,
      this.projects,
      (project) => this.palette(project),
      (project) => this.run(() => this.switching.activate(project ?? undefined)),
      true,
      (project) => this.annotation(project),
    ).open();
  }

  private reportIssue(): void {
    try {
      window.open(
        issues.newIssueUrl(this.settings.issueRepository),
        issues.EXTERNAL_TARGET,
        issues.EXTERNAL_FEATURES,
      );
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }

  private withProject(operation: (project: Project) => Promise<void>): void {
    const project = this.mainNotebook();
    if (project) {
      this.run(() => operation(project));
      return;
    }
    if (!this.projects.length) {
      new Notice("Create a project first.");
      return;
    }
    this.selectProject(this.projects, (item) => this.run(() => operation(item)));
  }

  private selectProject(
    projects: readonly Project[],
    choose: (project: Project) => void,
  ): void {
    new ProjectSwitcher(
      this.plugin.app,
      projects,
      (project) => this.palette(project),
      (project) => {
        if (project) choose(project);
      },
      false,
      (project) => this.annotation(project),
    ).open();
  }

  private annotation(project: Project): string {
    return features.isScratch(this.settings, project.folderPath)
      ? ` (${scratch.SCRATCH_INDICATOR} scratch)`
      : "";
  }

  private useCurrentNotebook(): void {
    const file = this.plugin.app.workspace.getActiveFile();
    const notebooks = new Map(
      this.projects.map((project) => [project.folderPath, project]),
    );
    const project = file ? notebookForFile(file.path, notebooks) : undefined;
    if (!project) {
      new Notice("Open a note in an active project first.");
      return;
    }
    this.commit(project);
  }

  private restoreLayout(): void {
    const project = this.mainNotebook();
    if (project) this.run(() => this.switching.activate(project, true));
    else this.showSwitcher();
  }

  private trashScratch(): void {
    const projects = this.projects.filter((project) =>
      features.isScratch(this.settings, project.folderPath),
    );
    const active = this.mainNotebook();
    if (active && features.isScratch(this.settings, active.folderPath))
      this.run(() => this.lifecycle.trash(active));
    else if (projects.length)
      this.selectProject(projects, (project) =>
        this.run(() => this.lifecycle.trash(project)),
      );
    else new Notice("There are no scratch projects to trash.");
  }

  private newProject(temporary: boolean = false): void {
    new NameModal(
      this.plugin.app,
      temporary ? "New scratch project" : "New project",
      async (name) => {
        await this.writes.run("projects", () => this.createProject(name, temporary));
      },
      { initialValue: temporary ? scratch.scratchName(new Date(), this.projects) : "" },
    ).open();
  }

  private async createProject(name: string, temporary: boolean): Promise<void> {
    if (this.disposed) return;
    const validated = discovery.assertProjectName(name, this.projects);
    const project = paths.projectFromPath(`${this.settings.projectsDir}/${validated}`);
    if (
      temporary &&
      !features.isScratch(this.settings, project.folderPath) &&
      this.projects.some(
        (item) => paths.collisionKey(item.name) === paths.collisionKey(validated),
      )
    ) {
      throw new Error("Choose a new name for the scratch project.");
    }
    await files.ensureFolder(this.plugin.app.vault, project.folderPath);
    if (temporary) {
      if (!features.isScratch(this.settings, project.folderPath))
        this.settings.scratchProjectPaths.push(project.folderPath);
      await this.persist();
    }
    await prepareProject(this.plugin.app.vault, project, this.settings);
    this.refreshProjects();
    if (features.projectFeatures(this.settings, project.folderPath).kanban)
      await baseService.ensureBase(
        this.plugin.app.vault,
        this.settings.projectsDir,
        this.projects,
        this.settings.palettesByProjectPath,
      );
    if (features.projectFeatures(this.settings, project.folderPath).kanban)
      await this.setupPlanner(false);
    if (!this.disposed) await this.switching.activate(project);
  }

  private newNote(task: boolean): void {
    this.withProject(async (project) => {
      new NameModal(
        this.plugin.app,
        task ? "New project task" : "New project note",
        async (title) => {
          if (this.disposed) return;
          const file = await createNote(
            this.plugin.app.vault,
            project,
            title,
            task ? this.settings.defaultTaskStatus : undefined,
          );
          if (!this.disposed && !task)
            await this.plugin.app.workspace.getLeaf("tab").openFile(file);
        },
      ).open();
    });
  }

  private async openProjectFile(project: Project, log: boolean): Promise<void> {
    await files.ensureFolder(this.plugin.app.vault, project.folderPath);
    const content =
      !log && !this.plugin.app.vault.getAbstractFileByPath(project.homepagePath)
        ? await loadTemplate(
            this.plugin.app.vault,
            this.settings.projectHomepageTemplate,
            { project: project.name, log: project.logPath, date: new Date() },
          )
        : "";
    await files.ensureFile(
      this.plugin.app.vault,
      log ? project.logPath : project.homepagePath,
      content,
    );
    const file = this.plugin.app.vault.getFileByPath(
      log ? project.logPath : project.homepagePath,
    );
    if (!file || this.disposed) return;
    const workspace = this.plugin.app.workspace;
    const existing = workspace.getLeavesOfType("markdown").find((leaf): boolean => {
      const state: unknown = leaf.getViewState().state;
      return (
        leaf.getRoot() === workspace.rootSplit &&
        settingsModel.isRecord(state) &&
        state.file === file.path
      );
    });
    const leaf = existing ?? workspace.getLeaf("tab");
    await leaf.openFile(file, {
      active: true,
      ...(log ? { state: { mode: "source" } } : {}),
    });
    if (log) await this.logs.ensureToday(file);
    if (
      log &&
      leaf.view instanceof MarkdownView &&
      this.plugin.app.workspace.getMostRecentLeaf() === leaf
    ) {
      moveToEnd(leaf.view.editor, true);
    }
  }

  private async setupPlanner(notifyIfCurrent: boolean = true): Promise<void> {
    const proposal = await baseService.proposeViews(
      this.plugin.app.vault,
      this.settings.projectsDir,
      this.projects,
      this.settings.palettesByProjectPath,
    );
    if (!proposal) {
      if (notifyIfCurrent) new Notice("Planner views and badge colors are up to date.");
      return;
    }
    const answer = await chooseAction(
      this.plugin.app,
      "Review planner configuration",
      `${proposal.path}: ${proposal.explanation} Badge colors update here after changing palettes.`,
      proposal.updated ? [{ label: "Apply previewed changes", value: "apply" }] : [],
      proposal.fragment,
    );
    if (answer === "apply" && !this.disposed) {
      await baseService.applyProposal(this.plugin.app.vault, proposal);
      await this.refreshPlanners();
    }
  }

  private async refreshPlanners(): Promise<void> {
    for (const leaf of this.plugin.app.workspace.getLeavesOfType(
      tasks.PLANNER_VIEW_TYPE,
    )) {
      if (!this.disposed && leaf.view instanceof PlannerView) await leaf.view.refresh();
    }
  }

  private async completeLifecycle(
    source: Project,
    target?: Project,
    movedPath?: string,
  ): Promise<void> {
    if (!movedPath) projectState.forgetProject(this.settings, source.folderPath);
    if (target && movedPath)
      this.settings.scratchProjectPaths = this.settings.scratchProjectPaths.filter(
        (path) => path !== movedPath,
      );
    this.refreshProjects();
    await this.persist();
    if (target) await this.switching.activate(target);
    else {
      this.commit();
      const planner = this.switching.layout.managed?.planner;
      if (!this.settings.homeShowKanban) planner?.detach();
      else if (planner?.view instanceof PlannerView)
        await planner.view.show(this.settings.projectsDir);
    }
  }

  private handleNavigation(): void {
    if (!this.ready || this.disposed || this.switching.busy) return;
    this.updateAppearance();
    this.handleActiveLog();
  }

  private handleActiveLog(): void {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (
      !view ||
      !(file instanceof TFile) ||
      !this.projects.some((project) => project.logPath === file.path)
    ) {
      this.lastLogView = null;
      this.lastLogFile = null;
      return;
    }
    const positionCursor = this.lastLogView !== view || this.lastLogFile !== file;
    this.lastLogView = view;
    this.lastLogFile = file;
    this.run(async () => {
      await this.logs.ensureToday(file);
      if (
        !this.disposed &&
        positionCursor &&
        view.getMode() === "source" &&
        view.file === file &&
        this.plugin.app.workspace.getActiveViewOfType(MarkdownView) === view
      )
        moveToEnd(view.editor, false);
    });
  }

  private scheduleFallback(): void {
    if (
      !this.ready ||
      this.disposed ||
      this.switching.busy ||
      this.fallbackPending ||
      this.restoringLog
    )
      return;
    this.fallbackPending = true;
    queueMicrotask(() => {
      this.fallbackPending = false;
      if (!this.disposed && !this.switching.busy) this.run(() => this.restoreEmptyLog());
    });
  }

  private async restoreEmptyLog(): Promise<void> {
    const project = this.mainNotebook();
    if (!project) return;
    const leaf = emptyManagedEditor(this.plugin.app, this.switching.layout, project);
    const file = this.plugin.app.vault.getFileByPath(project.logPath);
    if (!leaf || !file) return;
    this.restoringLog = true;
    try {
      await leaf.openFile(file, { active: true, state: { mode: "source" } });
      await this.logs.ensureToday(file);
      if (this.mainNotebook() === project) this.switching.layout.capture();
    } finally {
      this.restoringLog = false;
    }
  }
}
