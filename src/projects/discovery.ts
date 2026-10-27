import { TFolder, type Vault } from "obsidian";
import type { Project } from "./model";
import * as paths from "./paths";

export function discoverProjects(vault: Vault, directory: string): Project[] {
  const folder = vault.getAbstractFileByPath(directory);
  if (!(folder instanceof TFolder)) return [];
  return folder.children
    .filter((child): child is TFolder => child instanceof TFolder)
    .map((child) => paths.projectFromPath(child.path))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function affectsDiscovery(path: string, directory: string): boolean {
  return path === directory || path.slice(0, path.lastIndexOf("/")) === directory;
}

export function assertProjectName(name: string, projects: readonly Project[]): string {
  const validated = paths.validateName(name);
  if (paths.collisionKey(validated) === paths.collisionKey("Log")) {
    throw new Error("Choose a project name other than Log; its two notes would collide.");
  }
  const conflict = projects.find(
    (project) => paths.collisionKey(project.name) === paths.collisionKey(validated),
  );
  if (conflict && conflict.name !== validated) {
    throw new Error(`A project named ${conflict.name} already exists.`);
  }
  return validated;
}
