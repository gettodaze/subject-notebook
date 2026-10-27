import {
  getFrontMatterInfo,
  parseYaml,
  TFolder,
  type FileManager,
  type TFile,
  type Vault,
} from "obsidian";
import type { Project } from "./model";
import * as paths from "./paths";
import * as files from "./files";
import * as snapshots from "./inventory";
import * as tasks from "../tasks/model";
import { isRecord } from "../settings/model";

export interface TaskReassignment {
  readonly file: TFile;
  readonly originalProject: string | undefined;
}
export interface TransferPlan {
  readonly source: Project;
  readonly destination: string;
  readonly inventory: snapshots.ProjectInventory;
  readonly taskChanges: readonly TaskReassignment[];
  readonly targetProject?: string;
}
export interface TransferResult {
  readonly warning?: string;
}

export function assertDestination(
  vault: Vault,
  source: string,
  destination: string,
): void {
  paths.validateDirectory(destination);
  if (
    paths.collisionKey(destination) === paths.collisionKey(source) ||
    paths.collisionKey(destination).startsWith(`${paths.collisionKey(source)}/`)
  ) {
    throw new Error("A project cannot be moved into itself.");
  }
  const parent = destination.slice(0, destination.lastIndexOf("/"));
  const folder = vault.getFolderByPath(parent);
  const existingParent = vault.getAbstractFileByPath(parent);
  if (existingParent && !(existingParent instanceof TFolder))
    throw new Error(`Expected a folder at ${parent}.`);
  const name = destination.slice(destination.lastIndexOf("/") + 1);
  if (
    vault.getAbstractFileByPath(destination) ||
    folder?.children.some(
      (child) => paths.collisionKey(child.name) === paths.collisionKey(name),
    )
  )
    throw new Error(
      `Destination already exists: ${destination}. Choose another folder name.`,
    );
}

export async function prepareTransfer(
  vault: Vault,
  source: Project,
  destination: string,
  targetProject?: string,
): Promise<TransferPlan> {
  assertDestination(vault, source.folderPath, destination);
  assertTarget(vault, destination, targetProject);
  const snapshot = snapshots.inventory(vault, source.folderPath);
  const taskChanges: TaskReassignment[] = [];
  if (targetProject !== undefined) {
    for (const item of snapshot.files) {
      if (item.file.extension.toLowerCase() !== paths.MARKDOWN_FILE_TYPE) continue;
      const project = await taskProject(vault, item.file);
      if (project !== null && project !== targetProject)
        taskChanges.push({ file: item.file, originalProject: project });
    }
  }
  return { source, destination, inventory: snapshot, taskChanges, targetProject };
}

async function taskProject(
  vault: Vault,
  file: TFile,
): Promise<string | undefined | null> {
  const info = getFrontMatterInfo(await vault.read(file));
  if (!info.exists) return null;
  const metadata: unknown = parseYaml(info.frontmatter);
  if (!isRecord(metadata) || metadata[tasks.TYPE_PROPERTY] !== tasks.TASK_TYPE)
    return null;
  const project = metadata[tasks.PROJECT_PROPERTY];
  if (project !== undefined && typeof project !== "string") {
    throw new Error(
      `Task ${file.path} has a non-text project property. Fix it before combining.`,
    );
  }
  return project;
}

export async function executeTransfer(
  vault: Vault,
  fileManager: FileManager,
  plan: TransferPlan,
): Promise<TransferResult> {
  snapshots.assertUnchanged(vault, plan.inventory);
  assertDestination(vault, plan.source.folderPath, plan.destination);
  assertTarget(vault, plan.destination, plan.targetProject);
  const changed: TaskReassignment[] = [];
  try {
    await reassignTasks(fileManager, plan, changed);
    snapshots.assertSamePaths(vault, plan.inventory);
    assertTarget(vault, plan.destination, plan.targetProject);
    await ensureDestinationParent(vault, plan.destination);
    assertDestination(vault, plan.source.folderPath, plan.destination);
    await fileManager.renameFile(plan.inventory.folder, plan.destination);
    return {};
  } catch (error: unknown) {
    if (vault.getFolderByPath(plan.destination) === plan.inventory.folder) {
      return {
        warning: `Files moved, but Obsidian reported a link-update error: ${message(error)}`,
      };
    }
    await rollbackTasks(fileManager, changed, plan.targetProject);
    throw new Error(
      `Project was not moved. Task changes were reverted. ${message(error)}`,
    );
  }
}

async function reassignTasks(
  fileManager: FileManager,
  plan: TransferPlan,
  changed: TaskReassignment[],
): Promise<void> {
  if (plan.targetProject === undefined) return;
  for (const task of plan.taskChanges) {
    changed.push(task);
    await fileManager.processFrontMatter(
      task.file,
      (metadata: Record<string, unknown>): void => {
        if (
          metadata[tasks.TYPE_PROPERTY] !== tasks.TASK_TYPE ||
          metadata[tasks.PROJECT_PROPERTY] !== task.originalProject
        ) {
          throw new Error(`Task properties changed after preview: ${task.file.path}`);
        }
        metadata[tasks.PROJECT_PROPERTY] = plan.targetProject;
      },
    );
  }
}

async function rollbackTasks(
  fileManager: FileManager,
  changed: readonly TaskReassignment[],
  target: string | undefined,
): Promise<void> {
  const failures: string[] = [];
  for (const task of [...changed].reverse()) {
    try {
      await fileManager.processFrontMatter(
        task.file,
        (metadata: Record<string, unknown>): void => {
          if (metadata[tasks.PROJECT_PROPERTY] === task.originalProject) return;
          if (metadata[tasks.PROJECT_PROPERTY] !== target)
            throw new Error("Project property changed again.");
          if (task.originalProject === undefined) delete metadata[tasks.PROJECT_PROPERTY];
          else metadata[tasks.PROJECT_PROPERTY] = task.originalProject;
        },
      );
    } catch {
      failures.push(task.file.path);
    }
  }
  if (failures.length)
    throw new Error(
      `Project was not moved. Some task properties need review: ${failures.join(", ")}`,
    );
}

async function ensureDestinationParent(vault: Vault, destination: string): Promise<void> {
  const separator = destination.lastIndexOf("/");
  if (separator > 0) await files.ensureFolder(vault, destination.slice(0, separator));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertTarget(
  vault: Vault,
  destination: string,
  target: string | undefined,
): void {
  const parent = destination.slice(0, destination.lastIndexOf("/"));
  if (target !== undefined && !vault.getFolderByPath(parent)) {
    throw new Error("The target project was moved or deleted. Choose it again.");
  }
}
