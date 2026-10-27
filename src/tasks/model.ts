export const STATUSES = ["Backlog", "Soon", "Today", "Now", "Done"] as const;
export type TaskStatus = (typeof STATUSES)[number];
export const DEFAULT_STATUS: TaskStatus = "Backlog";
export const TYPE_PROPERTY = "type";
export const PROJECT_PROPERTY = "project";
export const STATUS_PROPERTY = "status";
export const TASK_TYPE = "task";
export const ALL_PROJECTS_VIEW = "All Projects";
export const PROJECT_VIEW_PREFIX = "Project: ";
export const PLANNER_VIEW_TYPE = "subject-notebook-planner";

export function isTaskStatus(value: unknown): value is TaskStatus {
  return STATUSES.some((status) => status === value);
}

export function projectViewName(name: string): string {
  return `${PROJECT_VIEW_PREFIX}${name}`;
}
