import { stringifyYaml, TFolder, type TFile, type Vault } from "obsidian";
import type { Project } from "../projects/model";
import * as paths from "../projects/paths";
import * as tasks from "./model";

export async function createNote(
  vault: Vault,
  project: Project,
  title: string,
  status?: tasks.TaskStatus,
): Promise<TFile> {
  const path = paths.notePath(project, title);
  const collision = vault.getAbstractFileByPath(project.folderPath);
  if (collision instanceof TFolder) {
    const children = collision.children;
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (
      children.some(
        (child) => paths.collisionKey(child.name) === paths.collisionKey(name),
      )
    ) {
      throw new Error(`A note named ${name} already exists. Choose another title.`);
    }
  }
  return vault.create(path, status ? taskContent(project.name, status) : "");
}

function taskContent(projectName: string, status: tasks.TaskStatus): string {
  const properties = {
    [tasks.TYPE_PROPERTY]: tasks.TASK_TYPE,
    [tasks.PROJECT_PROPERTY]: projectName,
    [tasks.STATUS_PROPERTY]: status,
  };
  return `---\n${stringifyYaml(properties)}---\n\n`;
}
