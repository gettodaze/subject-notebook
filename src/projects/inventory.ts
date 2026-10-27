import { TFile, TFolder, type Vault } from "obsidian";

export interface FileSnapshot {
  readonly file: TFile;
  readonly path: string;
  readonly modified: number;
  readonly size: number;
}
export interface ProjectInventory {
  readonly folder: TFolder;
  readonly path: string;
  readonly files: readonly FileSnapshot[];
  readonly folders: readonly string[];
}

export function inventory(vault: Vault, path: string): ProjectInventory {
  const root = vault.getFolderByPath(path);
  if (!root) throw new Error(`Project folder no longer exists: ${path}`);
  const files: FileSnapshot[] = [];
  const folders: string[] = [];
  const pending = [root];
  while (pending.length) {
    const folder = pending.pop()!;
    folders.push(folder.path);
    for (const child of folder.children) {
      if (child instanceof TFolder) pending.push(child);
      if (child instanceof TFile)
        files.push({
          file: child,
          path: child.path,
          modified: child.stat.mtime,
          size: child.stat.size,
        });
    }
  }
  return { folder: root, path, files, folders };
}

export function assertUnchanged(vault: Vault, expected: ProjectInventory): void {
  const actual = inventory(vault, expected.path);
  const describe = (value: ProjectInventory): string =>
    JSON.stringify({
      folders: [...value.folders].sort(),
      files: value.files.map((file) => [file.path, file.modified, file.size]).sort(),
    });
  if (describe(actual) !== describe(expected)) {
    throw new Error("The project changed after preview. Review the operation again.");
  }
}

export function assertSamePaths(vault: Vault, expected: ProjectInventory): void {
  const actual = inventory(vault, expected.path);
  const paths = (value: ProjectInventory): string =>
    JSON.stringify([...value.folders, ...value.files.map((file) => file.path)].sort());
  if (paths(actual) !== paths(expected))
    throw new Error("Project files changed during the operation. Please retry.");
}
