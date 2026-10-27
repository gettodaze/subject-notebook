import * as paths from "../projects/paths";
import * as tasks from "../tasks/model";
import * as palettes from "../themes/palettes";
import * as issues from "../support/issues";
import type { ProjectFeatures } from "./features";

export interface Settings {
  schemaVersion: number;
  projectsDir: string;
  defaultTaskStatus: tasks.TaskStatus;
  palettesByProjectPath: Record<string, string>;
  automaticDailyHeadings: boolean;
  projectStyling: boolean;
  showStatusBar: boolean;
  homeLandingNote: string;
  issueRepository: string;
  archiveDir: string;
  scratchProjectPaths: string[];
  projectFeaturesByPath: Record<string, ProjectFeatures>;
  projectHomepageTemplate: string;
  homeLandingTemplate: string;
  homeShowHomepage: boolean;
  homeShowKanban: boolean;
  lastProjectPath?: string | null;
}
export const SCHEMA_VERSION = 2;

export function defaultSettings(): Settings {
  return {
    schemaVersion: SCHEMA_VERSION,
    projectsDir: paths.DEFAULT_DIRECTORY,
    defaultTaskStatus: tasks.DEFAULT_STATUS,
    palettesByProjectPath: {},
    automaticDailyHeadings: true,
    projectStyling: true,
    showStatusBar: true,
    homeLandingNote: "",
    issueRepository: issues.DEFAULT_REPOSITORY,
    archiveDir: `${paths.DEFAULT_DIRECTORY}${paths.ARCHIVE_DIRECTORY_SUFFIX}`,
    scratchProjectPaths: [],
    projectFeaturesByPath: {},
    projectHomepageTemplate: "",
    homeLandingTemplate: "",
    homeShowHomepage: true,
    homeShowKanban: true,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseSettings(input: unknown): Settings {
  const result = defaultSettings();
  if (!isRecord(input)) return result;
  readDirectory(input, result);
  readPreferences(input, result);
  readProjectOptions(input, result);
  const assignments = input.palettesByProjectPath;
  if (isRecord(assignments)) {
    for (const [path, assignment] of Object.entries(assignments)) {
      if (palettes.isPaletteAssignment(assignment)) {
        Object.defineProperty(result.palettesByProjectPath, path, {
          value: assignment,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
  }
  return result;
}

function readDirectory(input: Record<string, unknown>, result: Settings): void {
  try {
    if (typeof input.projectsDir === "string")
      result.projectsDir = paths.validateDirectory(input.projectsDir);
  } catch {
    /* Invalid saved paths fall back to the safe default. */
  }
  result.archiveDir = `${result.projectsDir}${paths.ARCHIVE_DIRECTORY_SUFFIX}`;
  if (typeof input.archiveDir !== "string") return;
  try {
    const archive = paths.validateDirectory(input.archiveDir);
    paths.validateSeparateDirectories(result.projectsDir, archive);
    result.archiveDir = archive;
  } catch {
    /* Keep the separate default archive when saved paths are invalid. */
  }
}

function readPreferences(input: Record<string, unknown>, result: Settings): void {
  if (typeof input.issueRepository === "string")
    result.issueRepository = input.issueRepository;
  if (tasks.isTaskStatus(input.defaultTaskStatus)) {
    result.defaultTaskStatus = input.defaultTaskStatus;
  }
  const toggles = ["automaticDailyHeadings", "projectStyling", "showStatusBar"] as const;
  for (const key of toggles) {
    if (typeof input[key] === "boolean") result[key] = input[key];
  }
  if (typeof input.homeLandingNote === "string")
    result.homeLandingNote = input.homeLandingNote;
  for (const key of ["projectHomepageTemplate", "homeLandingTemplate"] as const) {
    if (typeof input[key] === "string") result[key] = input[key];
  }
  for (const key of ["homeShowHomepage", "homeShowKanban"] as const) {
    if (typeof input[key] === "boolean") result[key] = input[key];
  }
  if (input.lastProjectPath === null || typeof input.lastProjectPath === "string") {
    result.lastProjectPath = input.lastProjectPath;
  }
}

function readProjectOptions(input: Record<string, unknown>, result: Settings): void {
  if (Array.isArray(input.scratchProjectPaths)) {
    result.scratchProjectPaths = [
      ...new Set(
        input.scratchProjectPaths.filter(
          (path: unknown): path is string => typeof path === "string",
        ),
      ),
    ];
  }
  if (!isRecord(input.projectFeaturesByPath)) return;
  for (const [path, value] of Object.entries(input.projectFeaturesByPath)) {
    if (!isRecord(value)) continue;
    Object.defineProperty(result.projectFeaturesByPath, path, {
      value: { homepage: value.homepage !== false, kanban: value.kanban !== false },
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}
