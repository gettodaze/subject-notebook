import { parseYaml, stringifyYaml } from "obsidian";
import type { Project } from "../projects/model";
import { isRecord } from "../settings/model";
import * as palettes from "../themes/palettes";

export const FORMULA_NAME = "Project";
export const FORMULA_PROPERTY = `formula.${FORMULA_NAME}`;
const START_MARKER =
  "# Subject Notebook project badge (managed; review changes in settings)";
const END_MARKER = "# End Subject Notebook project badge";
const DEFAULT_COLOR = "#808080";

export function badgeFormula(
  projects: readonly Project[],
  assignments: Readonly<Record<string, string>>,
): string {
  let swatch = JSON.stringify(badgeHtml(DEFAULT_COLOR));
  for (const project of [...projects].reverse()) {
    const palette = palettes.resolvePalette(
      project.name,
      Object.hasOwn(assignments, project.folderPath)
        ? assignments[project.folderPath]
        : undefined,
    );
    swatch = `if(note.project == ${JSON.stringify(project.name)}, ${JSON.stringify(badgeHtml(palette.background))}, ${swatch})`;
  }
  return `html(${swatch} + " " + escapeHTML(note.project))`;
}

function badgeHtml(color: string): string {
  // Labels are escaped by Bases; only validated hex values enter this fixed markup.
  if (!palettes.HEX_COLOR.test(color)) throw new Error("Invalid project badge color.");
  return `<span style="display:inline-block;width:0.75em;height:0.75em;background-color:${color};border:1px solid #888;border-radius:50%;"></span>`;
}

export function formulaBlock(formula: string): string {
  const entry = stringifyYaml({ [FORMULA_NAME]: formula })
    .trimEnd()
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `  ${START_MARKER}\n${entry}\n  ${END_MARKER}\n`;
}

export function updateBadges(content: string, formula: string): string {
  const parsed: unknown = parseYaml(content);
  if (!isRecord(parsed)) throw new Error("Invalid Base configuration.");
  if (isRecord(parsed.formulas) && parsed.formulas[FORMULA_NAME] === formula)
    return content;
  if (isRecord(parsed.formulas) && Object.hasOwn(parsed.formulas, FORMULA_NAME)) {
    return validateUpdate(
      replaceManagedBlock(content, parsed.formulas[FORMULA_NAME], formula),
      formula,
    );
  }
  return validateUpdate(insertFormula(content, parsed.formulas, formula), formula);
}

function validateUpdate(content: string, formula: string): string {
  const parsed: unknown = parseYaml(content);
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.formulas) ||
    parsed.formulas[FORMULA_NAME] !== formula
  ) {
    throw new Error("Update the badge formula manually using the preview.");
  }
  return content;
}

function insertFormula(content: string, existing: unknown, formula: string): string {
  const match = /^formulas:[ \t]*(?:#[^\r\n]*)?\r?\n/mu.exec(content);
  if (existing !== undefined && (!isRecord(existing) || !match)) {
    throw new Error("Add the badge formula manually to the existing formulas mapping.");
  }
  const block = formulaBlock(formula);
  if (match)
    return (
      content.slice(0, match.index + match[0].length) +
      block +
      content.slice(match.index + match[0].length)
    );
  return `${content}${content.endsWith("\n") ? "" : "\n"}formulas:\n${block}`;
}

function replaceManagedBlock(content: string, current: unknown, formula: string): string {
  if (typeof current !== "string")
    throw new Error("Existing project badge formula is not a string.");
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const previous = formulaBlock(current).replaceAll("\n", newline);
  if (!content.includes(previous)) {
    throw new Error(
      "The badge formula was customized. Update it manually using the preview.",
    );
  }
  return content.replace(previous, () => formulaBlock(formula).replaceAll("\n", newline));
}
