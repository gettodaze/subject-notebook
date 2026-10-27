import type { Project } from "./model";
import { collisionKey } from "./paths";
import { localDate } from "../logs/daily-section";

export const SCRATCH_LABEL = "Scratch";
export const SCRATCH_INDICATOR = "⏱";
const TIME_PART_WIDTH = 2;

export function scratchName(now: Date, projects: readonly Project[]): string {
  const hour = String(now.getHours()).padStart(TIME_PART_WIDTH, "0");
  const minute = String(now.getMinutes()).padStart(TIME_PART_WIDTH, "0");
  const base = `${SCRATCH_LABEL} ${localDate(now)} ${hour}-${minute}`;
  const used = new Set(projects.map((project) => collisionKey(project.name)));
  let name = base;
  let suffix = 2;
  while (used.has(collisionKey(name))) name = `${base} (${suffix++})`;
  return name;
}
