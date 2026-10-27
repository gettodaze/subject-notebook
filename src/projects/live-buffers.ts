import { MarkdownView, type TFile, type Workspace } from "obsidian";
import type { Project } from "./model";
import { belongsToProject } from "./paths";

export async function saveProjectEditors(
  workspace: Workspace,
  project: Project,
): Promise<void> {
  const editors = new Map<TFile, MarkdownView>();
  const active = workspace.getActiveViewOfType(MarkdownView);
  if (active?.file && belongsToProject(active.file.path, project))
    editors.set(active.file, active);
  workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view;
    if (
      view instanceof MarkdownView &&
      view.file &&
      belongsToProject(view.file.path, project) &&
      !editors.has(view.file)
    )
      editors.set(view.file, view);
  });
  // Use the native save lifecycle before taking the reviewed on-disk snapshot.
  for (const view of editors.values()) await view.save();
}
