import type { Settings } from "./model";

export function moveProjectPreferences(
  settings: Settings,
  oldPath: string,
  newPath: string,
  palette: string,
): void {
  const assignments = settings.palettesByProjectPath;
  const color = Object.hasOwn(assignments, oldPath) ? assignments[oldPath] : palette;
  Object.defineProperty(assignments, newPath, {
    value: color,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  delete assignments[oldPath];
  moveRecord(settings.projectFeaturesByPath, oldPath, newPath);
  settings.scratchProjectPaths = settings.scratchProjectPaths.map((path) =>
    path === oldPath ? newPath : path,
  );
}

function moveRecord<T>(
  values: Record<string, T>,
  oldPath: string,
  newPath: string,
): void {
  if (!Object.hasOwn(values, oldPath)) return;
  Object.defineProperty(values, newPath, {
    value: values[oldPath],
    enumerable: true,
    writable: true,
    configurable: true,
  });
  delete values[oldPath];
}

export function forgetProject(settings: Settings, path: string): void {
  delete settings.palettesByProjectPath[path];
  delete settings.projectFeaturesByPath[path];
  settings.scratchProjectPaths = settings.scratchProjectPaths.filter(
    (item) => item !== path,
  );
}
