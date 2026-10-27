import { normalizePath } from "obsidian";
import type { Project } from "./model";

export const DEFAULT_DIRECTORY = "Projects";
export const LOG_FILENAME = "Log.md";
export const BASE_FILENAME = "Tasks.base";
export const MARKDOWN_EXTENSION = ".md";
export const MARKDOWN_FILE_TYPE = "md";
export const ARCHIVE_DIRECTORY_SUFFIX = " Archive";
const INVALID_NAME = /[<>:"/\\|?*#\[\]^\u0000-\u001f\u007f]/u;
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export function collisionKey(name: string): string {
  return name.normalize("NFC").toLocaleLowerCase("en-US");
}

export function validateName(name: string): string {
  if (!name.trim() || name !== name.trim() || /[. ]$/u.test(name)) {
    throw new Error("Use a name without leading/trailing spaces or a trailing dot.");
  }
  if (INVALID_NAME.test(name) || RESERVED_NAME.test(name) || name === ".") {
    throw new Error("This name contains invalid or reserved filename characters.");
  }
  return name.normalize("NFC");
}

export function validateDirectory(value: string): string {
  const segments = value.replaceAll("\\", "/").split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    throw new Error("Projects directory must be a vault-relative folder path.");
  }
  segments.forEach(validateName);
  return normalizePath(segments.join("/"));
}

export function projectFromPath(folderPath: string): Project {
  const name = folderPath.slice(folderPath.lastIndexOf("/") + 1);
  return {
    name,
    folderPath,
    logPath: `${folderPath}/${LOG_FILENAME}`,
    homepagePath: `${folderPath}/${name}${MARKDOWN_EXTENSION}`,
  };
}

export function notePath(project: Project, title: string): string {
  const name = title.endsWith(MARKDOWN_EXTENSION)
    ? title.slice(0, -MARKDOWN_EXTENSION.length)
    : title;
  return `${project.folderPath}/${validateName(name)}${MARKDOWN_EXTENSION}`;
}

export function basePath(directory: string): string {
  return `${directory}/${BASE_FILENAME}`;
}

export function belongsToProject(path: string, project: Project): boolean {
  return path.startsWith(`${project.folderPath}/`);
}

export function validateSeparateDirectories(projects: string, archive: string): void {
  const active = collisionKey(projects);
  const archived = collisionKey(archive);
  if (
    active === archived ||
    active.startsWith(`${archived}/`) ||
    archived.startsWith(`${active}/`)
  ) {
    throw new Error("Projects and archive directories must be separate folder trees.");
  }
}

export function isProjectLogPath(path: string, directory: string): boolean {
  if (!path.startsWith(`${directory}/`)) return false;
  const segments = path.slice(directory.length + 1).split("/");
  return segments.length === 2 && segments[1] === LOG_FILENAME;
}

export function validateMarkdownPath(path: string): string {
  const validated = validateDirectory(path);
  if (!validated.toLowerCase().endsWith(MARKDOWN_EXTENSION)) {
    throw new Error("Choose a vault-relative Markdown (.md) file path.");
  }
  return validated;
}
