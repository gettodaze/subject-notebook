import { App, MarkdownView, type WorkspaceLeaf } from "obsidian";
import type { Project } from "../projects/model";
import type { ProjectLayout } from "./project-layout";

export function emptyManagedEditor(
  app: App,
  layout: ProjectLayout,
  project: Project,
): WorkspaceLeaf | undefined {
  const present = new Set<WorkspaceLeaf>();
  let logPresent = false;
  app.workspace.iterateAllLeaves((leaf) => {
    present.add(leaf);
    if (
      leaf.getRoot() === app.workspace.rootSplit &&
      leaf.view instanceof MarkdownView &&
      leaf.view.file &&
      leaf.view.file.path === project.logPath
    )
      logPresent = true;
  });
  if (logPresent || !layout.managed) return undefined;
  return [layout.managed.log].find(
    (leaf): leaf is WorkspaceLeaf =>
      leaf !== undefined &&
      present.has(leaf) &&
      leaf === app.workspace.getMostRecentLeaf() &&
      leaf.view.getViewType() === "empty",
  );
}
