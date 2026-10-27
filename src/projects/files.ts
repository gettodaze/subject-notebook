import { TFile, TFolder, type Vault } from "obsidian";
import type { Project } from "./model";

export interface ProjectFileOptions {
  readonly homepage?: boolean;
  readonly homepageContent?: () => Promise<string>;
}

export async function ensureFolder(vault: Vault, path: string): Promise<void> {
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFolder) return;
  if (existing) throw new Error(`Expected a folder at ${path}.`);
  const separator = path.lastIndexOf("/");
  if (separator > 0) await ensureFolder(vault, path.slice(0, separator));
  try {
    await vault.createFolder(path);
  } catch (error: unknown) {
    if (!(vault.getAbstractFileByPath(path) instanceof TFolder)) throw error;
  }
}

export async function ensureFile(
  vault: Vault,
  path: string,
  content: string = "",
): Promise<TFile> {
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  if (existing) throw new Error(`Expected a file at ${path}.`);
  try {
    return await vault.create(path, content);
  } catch (error: unknown) {
    const concurrent = vault.getAbstractFileByPath(path);
    if (concurrent instanceof TFile) return concurrent;
    throw error;
  }
}

export async function ensureProjectFiles(
  vault: Vault,
  project: Project,
  options: ProjectFileOptions = {},
): Promise<void> {
  await ensureFolder(vault, project.folderPath);
  await ensureFile(vault, project.logPath);
  if (options.homepage === false) return;
  const existing = vault.getAbstractFileByPath(project.homepagePath);
  const initial = existing ? "" : ((await options.homepageContent?.()) ?? "");
  await ensureFile(vault, project.homepagePath, initial);
}
