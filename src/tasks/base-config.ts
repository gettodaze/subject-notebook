import { parseYaml, stringifyYaml } from "obsidian";
import { isRecord } from "../settings/model";
import type { Project } from "../projects/model";
import * as tasks from "./model";
import * as badges from "./project-badges";

export interface BaseView {
  readonly type: string;
  readonly name: string;
  readonly filters?: { readonly and: readonly string[] };
  readonly groupBy: { readonly property: string; readonly direction: string };
  readonly groupOrder: readonly tasks.TaskStatus[];
  readonly order: readonly string[];
}

export function createView(project?: Project): BaseView {
  return {
    type: "kanban",
    name: project ? tasks.projectViewName(project.name) : tasks.ALL_PROJECTS_VIEW,
    ...(project ? { filters: { and: [projectFilter(project.name)] } } : {}),
    groupBy: { property: `note.${tasks.STATUS_PROPERTY}`, direction: "ASC" },
    groupOrder: tasks.STATUSES,
    order: ["file.name", badges.FORMULA_PROPERTY],
  };
}

export function projectFilter(name: string): string {
  return `note.${tasks.PROJECT_PROPERTY} == ${JSON.stringify(name)}`;
}

export function generateBase(
  directory: string,
  projects: readonly Project[],
  assignments: Readonly<Record<string, string>> = {},
): string {
  const content = stringifyYaml({
    filters: {
      and: [
        'file.ext == "md"',
        `file.inFolder(${JSON.stringify(directory)})`,
        `note.${tasks.TYPE_PROPERTY} == ${JSON.stringify(tasks.TASK_TYPE)}`,
      ],
    },
    views: [createView(), ...projects.map((project) => createView(project))],
    properties: { [badges.FORMULA_PROPERTY]: { displayName: "Project" } },
  });
  return badges.updateBadges(content, badges.badgeFormula(projects, assignments));
}

export function readViews(content: string): Record<string, unknown>[] {
  const parsed: unknown = parseYaml(content);
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.views) ||
    !parsed.views.every(isRecord)
  ) {
    throw new Error("Tasks.base needs a valid YAML object with a views list.");
  }
  const names = parsed.views.map((view) => view.name);
  if (
    names.some((name) => typeof name !== "string") ||
    new Set(names).size !== names.length
  ) {
    throw new Error("Tasks.base has missing or duplicate view names.");
  }
  return parsed.views;
}

export function hasView(content: string, project?: Project): boolean {
  const name = project ? tasks.projectViewName(project.name) : tasks.ALL_PROJECTS_VIEW;
  const view = readViews(content).find((entry) => entry.name === name);
  if (!view) return false;
  if (view.type !== "kanban") throw new Error(`The existing ${name} view is not Kanban.`);
  if (project && !hasProjectFilter(view.filters, project.name)) {
    throw new Error(
      `The existing ${name} view needs the filter: ${projectFilter(project.name)}`,
    );
  }
  return true;
}

function hasProjectFilter(value: unknown, name: string): boolean {
  if (value === projectFilter(name)) return true;
  return (
    isRecord(value) &&
    Array.isArray(value.and) &&
    value.and.some((filter: unknown) => hasProjectFilter(filter, name))
  );
}

export function viewFragment(project?: Project): string {
  return stringifyYaml([createView(project)])
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}

export function appendViews(content: string, fragment: string): string {
  // Only insert into an ordinary top-level block sequence; preserve all other bytes.
  readViews(content);
  const match = /^views:[ \t]*(?:#[^\r\n]*)?\r?\n/gmu.exec(content);
  if (!match)
    throw new Error("Add the displayed fragment manually under views in Tasks.base.");
  const start = match.index + match[0].length;
  const nextKey = /^[^\s#-][^\r\n]*:/gmu;
  nextKey.lastIndex = start;
  const end = nextKey.exec(content)?.index ?? content.length;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const insertion = fragment.replace(/\r?\n/gu, newline);
  const prefix = content.slice(0, end);
  const result =
    prefix + (prefix.endsWith(newline) ? "" : newline) + insertion + content.slice(end);
  readViews(result);
  return result;
}
