import { App, MarkdownView, type WorkspaceLeaf, type WorkspaceParent } from "obsidian";
import type { Project } from "../projects/model";
import { chooseAction } from "../ui/modals";
import * as taskModel from "../tasks/model";
import { PlannerView } from "../tasks/planner-view";
import { isRecord } from "../settings/model";
import type { ProjectFeatures } from "../settings/features";

export interface ProjectLeaves {
  readonly log: WorkspaceLeaf;
  readonly homepage?: WorkspaceLeaf;
  readonly planner?: WorkspaceLeaf;
}
interface LeafExpectation {
  readonly leaf: WorkspaceLeaf;
  readonly parent: WorkspaceParent;
  readonly grandparent: WorkspaceParent;
  readonly file: string | null;
  readonly type: string;
}
type LayoutMode = "panes" | "tabs";

export class ProjectLayout {
  private leaves: ProjectLeaves | null = null;
  private expected: LeafExpectation[] = [];
  private mode: LayoutMode = "panes";

  constructor(private readonly app: App) {}

  reset(): void {
    this.leaves = null;
    this.expected = [];
  }
  get managed(): ProjectLeaves | null {
    return this.leaves;
  }

  renamed(oldPath: string, newPath: string): void {
    this.expected = this.expected.map((item) => ({
      ...item,
      file:
        item.file === oldPath || item.file?.startsWith(`${oldPath}/`)
          ? newPath + item.file.slice(oldPath.length)
          : item.file,
    }));
  }

  adopt(project: Project): void {
    const main: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.getRoot() === this.app.workspace.rootSplit) main.push(leaf);
    });
    const logs = main.filter((leaf) => leafFilePath(leaf) === project.logPath);
    const pages = main.filter((leaf) => leafFilePath(leaf) === project.homepagePath);
    const planners = main.filter((leaf) => isProjectPlanner(leaf, project));
    if (logs.length !== 1 || pages.length > 1 || planners.length > 1) return;
    this.leaves = {
      log: logs[0]!,
      homepage: pages[0],
      planner: planners[0],
    };
    this.mode = ownedLeaves(this.leaves).every(
      (leaf) => leaf.parent === this.leaves?.log.parent,
    )
      ? "tabs"
      : "panes";
    this.capture();
  }

  async prepare(
    current: () => boolean,
    features: ProjectFeatures,
    force: boolean = false,
  ): Promise<ProjectLeaves | null> {
    if (this.leaves && this.isIntact()) {
      if (force || !this.matches(features))
        await this.reconfigure(features, current, force);
      return this.leaves;
    }
    const mode = await this.chooseLayout();
    if (!mode || !current()) return null;
    this.mode = mode;
    this.leaves = this.build(this.app.workspace.getLeaf("tab"), features);
    this.capture();
    return this.leaves;
  }

  private async chooseLayout(): Promise<LayoutMode | null> {
    const occupied = this.app.workspace.getLeavesOfType("markdown").length > 0;
    if (!this.leaves && !occupied) return "panes";
    const mode = await chooseAction(
      this.app,
      "Open project layout",
      "Only the selected layout features will open. Existing unrelated notes and tabs stay available.",
      [
        { label: "Arrange project panes", value: "panes" },
        { label: "Keep layout and use project tabs", value: "tabs" },
      ],
    );
    return mode === "panes" || mode === "tabs" ? mode : null;
  }

  private matches(features: ProjectFeatures): boolean {
    return (
      !!this.leaves?.homepage === features.homepage &&
      !!this.leaves?.planner === features.kanban
    );
  }

  private async reconfigure(
    features: ProjectFeatures,
    current: () => boolean,
    force: boolean,
  ): Promise<void> {
    if (!this.leaves) return;
    const primary = this.leaves.log;
    for (const view of [this.leaves.homepage?.view, this.leaves.planner?.view]) {
      if (view instanceof MarkdownView) await view.save();
    }
    if (!current()) return;
    if (force) this.mode = "panes";
    // The integrity check ensures these are unchanged owned views, not user replacements.
    this.leaves.homepage?.detach();
    this.leaves.planner?.detach();
    this.leaves = this.build(primary, features);
    this.capture();
  }

  private build(log: WorkspaceLeaf, features: ProjectFeatures): ProjectLeaves {
    const workspace = this.app.workspace;
    const planner = features.kanban
      ? this.mode === "panes"
        ? workspace.createLeafBySplit(log, "horizontal")
        : workspace.getLeaf("tab")
      : undefined;
    const homepage = features.homepage
      ? this.mode === "panes"
        ? workspace.createLeafBySplit(log, "vertical")
        : workspace.getLeaf("tab")
      : undefined;
    return { log, homepage, planner };
  }

  capture(): void {
    if (!this.leaves) return;
    this.expected = ownedLeaves(this.leaves).map((leaf) => ({
      leaf,
      parent: leaf.parent,
      grandparent: leaf.parent.parent,
      file: leafFilePath(leaf),
      type: leaf.getViewState().type,
    }));
  }

  isIntact(): boolean {
    const present = new Set<WorkspaceLeaf>();
    this.app.workspace.iterateAllLeaves((leaf) => {
      present.add(leaf);
    });
    return (
      this.expected.length > 0 &&
      this.expected.every(
        (item) =>
          present.has(item.leaf) &&
          item.leaf.parent === item.parent &&
          item.leaf.parent.parent === item.grandparent &&
          this.ownsContent(item) &&
          !item.leaf.getViewState().pinned,
      )
    );
  }

  private ownsContent(expected: LeafExpectation): boolean {
    const type = expected.leaf.getViewState().type;
    const file = leafFilePath(expected.leaf);
    if (type === expected.type && file === expected.file) return true;
    if (type === "empty") return true;
    // Reference notes may occupy managed panes without changing the main notebook.
    return type === "markdown" && file !== null;
  }

  async openFiles(
    leaves: ProjectLeaves,
    project: Project,
    current: () => boolean,
  ): Promise<void> {
    const log = this.app.vault.getFileByPath(project.logPath);
    if (!log) throw new Error("Project log was moved or deleted.");
    await leaves.log.openFile(log, { active: false, state: { mode: "source" } });
    if (!leaves.homepage || !current()) return;
    const homepage = this.app.vault.getFileByPath(project.homepagePath);
    if (!homepage) throw new Error("Project homepage was moved or deleted.");
    await leaves.homepage.openFile(homepage, { active: true });
  }

  async showPlanner(
    leaves: ProjectLeaves,
    directory: string,
    project?: Project,
  ): Promise<void> {
    const planner = leaves.planner;
    if (!planner) return;
    await planner.setViewState({ type: taskModel.PLANNER_VIEW_TYPE, active: true });
    await planner.loadIfDeferred();
    if (planner.view instanceof PlannerView) await planner.view.show(directory, project);
  }
}

function ownedLeaves(leaves: ProjectLeaves): WorkspaceLeaf[] {
  return [leaves.log, leaves.homepage, leaves.planner].filter(
    (leaf): leaf is WorkspaceLeaf => leaf !== undefined,
  );
}

function leafFilePath(leaf: WorkspaceLeaf): string | null {
  const state: unknown = leaf.getViewState().state;
  return isRecord(state) && typeof state.file === "string" ? state.file : null;
}

function isProjectPlanner(leaf: WorkspaceLeaf, project: Project): boolean {
  const state: unknown = leaf.getViewState().state;
  return (
    leaf.getViewState().type === taskModel.PLANNER_VIEW_TYPE &&
    isRecord(state) &&
    state.projectPath === project.folderPath
  );
}
