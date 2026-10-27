import type { Project } from "./model";

export function notebookForFile(
  path: string,
  notebooks: ReadonlyMap<string, Project>,
): Project | undefined {
  let separator = path.lastIndexOf("/");
  while (separator >= 0) {
    const folder = path.slice(0, separator);
    const notebook = notebooks.get(folder);
    if (notebook) return notebook;
    separator = folder.lastIndexOf("/");
  }
  return undefined;
}
