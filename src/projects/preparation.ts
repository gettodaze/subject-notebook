import type { Vault } from "obsidian";
import type { Settings } from "../settings/model";
import { projectFeatures } from "../settings/features";
import type { Project } from "./model";
import { ensureProjectFiles } from "./files";
import { loadTemplate } from "./templates";

export async function prepareProject(
  vault: Vault,
  project: Project,
  settings: Settings,
): Promise<void> {
  await ensureProjectFiles(vault, project, {
    homepage: projectFeatures(settings, project.folderPath).homepage,
    homepageContent: () =>
      loadTemplate(vault, settings.projectHomepageTemplate, {
        project: project.name,
        log: project.logPath,
        date: new Date(),
      }),
  });
}
