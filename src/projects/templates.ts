import type { Vault } from "obsidian";
import * as paths from "./paths";
import { localDate } from "../logs/daily-section";

export interface TemplateContext {
  readonly project: string;
  readonly log: string;
  readonly date: Date;
}
const PROJECT_TOKEN = "{{project}}";
const LOG_TOKEN = "{{log}}";
const DATE_TOKEN = "{{date}}";

export function renderTemplate(content: string, context: TemplateContext): string {
  const values: Readonly<Record<string, string>> = {
    [PROJECT_TOKEN]: context.project,
    [LOG_TOKEN]: context.log ? `[[${context.log}]]` : "",
    [DATE_TOKEN]: localDate(context.date),
  };
  return content.replace(
    /\{\{(?:project|log|date)\}\}/gu,
    (token) => values[token] ?? token,
  );
}

export async function loadTemplate(
  vault: Vault,
  path: string,
  context: TemplateContext,
): Promise<string> {
  if (!path) return "";
  const file = vault.getFileByPath(paths.validateMarkdownPath(path));
  if (!file) throw new Error(`Template not found: ${path}`);
  return renderTemplate(await vault.read(file), context);
}
