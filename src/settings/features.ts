import type { Settings } from "./model";

export interface ProjectFeatures {
  readonly homepage: boolean;
  readonly kanban: boolean;
}

export const DEFAULT_FEATURES: ProjectFeatures = { homepage: true, kanban: true };

export function projectFeatures(settings: Settings, path: string): ProjectFeatures {
  return Object.hasOwn(settings.projectFeaturesByPath, path)
    ? (settings.projectFeaturesByPath[path] ?? DEFAULT_FEATURES)
    : DEFAULT_FEATURES;
}

export function homeFeatures(settings: Settings): ProjectFeatures {
  return {
    homepage: settings.homeShowHomepage && settings.homeLandingNote.length > 0,
    kanban: settings.homeShowKanban,
  };
}

export function isScratch(settings: Settings, path: string): boolean {
  return settings.scratchProjectPaths.includes(path);
}
