import { TFile, type Vault } from "obsidian";
import type { Project } from "../projects/model";
import * as paths from "../projects/paths";
import * as files from "../projects/files";
import * as config from "./base-config";
import * as badges from "./project-badges";

export interface BaseProposal {
  readonly path: string;
  readonly original: string;
  readonly updated: string | null;
  readonly fragment: string;
  readonly explanation: string;
}

export async function ensureBase(
  vault: Vault,
  directory: string,
  projects: readonly Project[],
  assignments: Readonly<Record<string, string>> = {},
): Promise<TFile> {
  const path = paths.basePath(directory);
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  return files.ensureFile(
    vault,
    path,
    config.generateBase(directory, projects, assignments),
  );
}

export async function proposeViews(
  vault: Vault,
  directory: string,
  projects: readonly Project[],
  assignments: Readonly<Record<string, string>> = {},
): Promise<BaseProposal | null> {
  const path = paths.basePath(directory);
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile))
    throw new Error(`Create ${path} by creating a project first.`);
  const original = await vault.read(file);
  const needed = [undefined, ...projects].filter(
    (project) => !config.hasView(original, project),
  );
  const viewFragment = needed.map((project) => config.viewFragment(project)).join("");
  return buildProposal(
    path,
    original,
    viewFragment,
    badges.badgeFormula(projects, assignments),
  );
}

function buildProposal(
  path: string,
  original: string,
  viewFragment: string,
  formula: string,
): BaseProposal | null {
  const fragment = `${viewFragment ? `# Add under views:\n${viewFragment}` : ""}# Add/update under formulas:\n${badges.formulaBlock(formula)}`;
  const preview = { path, original, fragment };
  try {
    const withViews = viewFragment
      ? config.appendViews(original, viewFragment)
      : original;
    const updated = badges.updateBadges(withViews, formula);
    config.readViews(updated);
    if (updated === original) return null;
    return {
      ...preview,
      updated,
      explanation:
        "Existing content outside the previewed additions and managed badge formula is preserved.",
    };
  } catch (error: unknown) {
    return {
      ...preview,
      updated: null,
      explanation: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function applyProposal(vault: Vault, proposal: BaseProposal): Promise<void> {
  if (proposal.updated === null)
    throw new Error("This proposal requires manual editing.");
  const updated = proposal.updated;
  const file = vault.getAbstractFileByPath(proposal.path);
  if (!(file instanceof TFile)) throw new Error("The Base file was moved or deleted.");
  await vault.process(file, (current) => {
    if (current !== proposal.original) {
      throw new Error(
        "Tasks.base changed after preview. Review a fresh proposal before saving.",
      );
    }
    config.readViews(updated);
    return updated;
  });
}
