import { App, Notice } from "obsidian";
import type { Project } from "./model";
import type { Settings } from "../settings/model";
import * as paths from "./paths";
import * as snapshots from "./inventory";
import * as transfer from "./transfer";
import { FileQueue } from "../core/serial";
import { NameModal, chooseAction } from "../ui/modals";
import { saveProjectEditors } from "./live-buffers";

export interface LifecycleActions {
  readonly settings: () => Settings;
  readonly projects: () => readonly Project[];
  readonly selectProject: (
    projects: readonly Project[],
    choose: (project: Project) => void,
  ) => void;
  readonly completed: (
    source: Project,
    destination?: Project,
    movedPath?: string,
  ) => Promise<void>;
}

export class ProjectLifecycle {
  private readonly operations = new FileQueue();
  private disposed = false;

  constructor(
    private readonly app: App,
    private readonly actions: LifecycleActions,
  ) {}
  dispose(): void {
    this.disposed = true;
  }

  combine(source: Project): void {
    if (this.disposed) return;
    const targets = this.actions
      .projects()
      .filter((project) => project.folderPath !== source.folderPath);
    if (!targets.length) {
      new Notice("Create a target project before combining projects.");
      return;
    }
    this.actions.selectProject(targets, (target) => this.promptMove(source, target));
  }

  private promptMove(source: Project, target: Project): void {
    if (this.disposed) return;
    new NameModal(
      this.app,
      `Combine ${source.name} into ${target.name}`,
      async (name, current) => {
        const destination = `${target.folderPath}/${paths.validateName(name)}`;
        await this.operations.run("lifecycle", async () => {
          if (!current() || this.disposed) return;
          await saveProjectEditors(this.app.workspace, source);
          const plan = await transfer.prepareTransfer(
            this.app.vault,
            source,
            destination,
            target.name,
          );
          if (current() && (await this.confirmMove(plan, "Combine project")))
            await this.apply(plan, target);
        });
      },
      {
        initialValue: source.name,
        submitLabel: "Review move",
        description:
          "The source folder becomes a subfolder of the target. Logs stay separate; task project properties follow the target.",
      },
    ).open();
  }

  archive(source: Project): void {
    if (this.disposed) return;
    new NameModal(
      this.app,
      `Archive ${source.name}`,
      async (name, current) => {
        const settings = this.actions.settings();
        paths.validateSeparateDirectories(settings.projectsDir, settings.archiveDir);
        const destination = `${settings.archiveDir}/${paths.validateName(name)}`;
        await this.operations.run("lifecycle", async () => {
          if (!current() || this.disposed) return;
          await saveProjectEditors(this.app.workspace, source);
          const plan = await transfer.prepareTransfer(
            this.app.vault,
            source,
            destination,
          );
          if (current() && (await this.confirmMove(plan, "Archive project")))
            await this.apply(plan);
        });
      },
      {
        initialValue: source.name,
        submitLabel: "Review archive",
        description:
          "Move the whole folder outside active projects. Notes and task properties remain intact.",
      },
    ).open();
  }

  async trash(source: Project): Promise<void> {
    await this.operations.run("lifecycle", async () => {
      if (this.disposed) return;
      await saveProjectEditors(this.app.workspace, source);
      const snapshot = snapshots.inventory(this.app.vault, source.folderPath);
      const answer = await chooseAction(
        this.app,
        `Trash ${source.name}?`,
        `Move this project and its ${snapshot.files.length} files into this vault's .trash folder. No automatic expiry or permanent deletion.`,
        [{ label: "Move project to vault trash", value: "trash" }],
        source.folderPath,
      );
      if (answer !== "trash" || this.disposed) return;
      snapshots.assertUnchanged(this.app.vault, snapshot);
      await this.app.vault.trash(snapshot.folder, false);
      if (!this.disposed) await this.actions.completed(source);
    });
  }

  private async confirmMove(
    plan: transfer.TransferPlan,
    title: string,
  ): Promise<boolean> {
    const preview = [
      `${plan.source.folderPath} → ${plan.destination}`,
      `${plan.inventory.files.length} files; ${plan.taskChanges.length} task project properties to update.`,
      ...plan.taskChanges.map(
        (task) =>
          `${task.file.path}: ${task.originalProject ?? "(unset)"} → ${plan.targetProject}`,
      ),
    ].join("\n");
    const answer = await chooseAction(
      this.app,
      title,
      "No files are overwritten. Logs stay separate. Obsidian handles link updates using your normal settings. Existing Base views are preserved and can be removed manually when no longer needed.",
      [{ label: "Move these files", value: "move" }],
      preview,
    );
    return answer === "move" && !this.disposed;
  }

  private async apply(plan: transfer.TransferPlan, target?: Project): Promise<void> {
    if (this.disposed) return;
    const result = await transfer.executeTransfer(
      this.app.vault,
      this.app.fileManager,
      plan,
    );
    if (result.warning) new Notice(result.warning, 10000);
    if (!this.disposed)
      await this.actions.completed(plan.source, target, plan.destination);
  }
}
