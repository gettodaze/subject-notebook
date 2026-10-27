import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";
import * as badges from "../src/tasks/project-badges";
import * as config from "../src/tasks/base-config";
import * as paths from "../src/projects/paths";

const PROJECT = paths.projectFromPath("Projects/PFAS");

test("native badge formula uses exact palette hex and escapes project text", (): void => {
  const formula = badges.badgeFormula([PROJECT], {});
  assert(formula.includes("#2d4841"));
  assert(formula.includes("escapeHTML(note.project)"));
  assert.equal(
    badges
      .badgeFormula([PROJECT], { [PROJECT.folderPath]: "#123456" })
      .includes("#123456"),
    true,
  );
});

test("managed badge updates preserve unrelated formulas and all other content", (): void => {
  const content = config.generateBase("Projects", [PROJECT]) + "# user comment\n";
  const original = parse(content) as { formulas: Record<string, string> };
  const updated = badges.updateBadges(content, "new formula");
  assert(updated.endsWith("# user comment\n"));
  assert.equal(
    updated,
    content.replace(
      badges.formulaBlock(original.formulas[badges.FORMULA_NAME]!),
      badges.formulaBlock("new formula"),
    ),
  );
  assert.equal(badges.updateBadges(updated, "new formula"), updated);
});

test("customized formulas are never replaced automatically", (): void => {
  assert.throws(
    () =>
      badges.updateBadges(
        `formulas:\n  ${badges.FORMULA_NAME}: user-defined\n`,
        "replacement",
      ),
    /customized/u,
  );
  const content = "views: []\nformulas:\n  userMetric: '1 + 1' # keep\n";
  assert(badges.updateBadges(content, "new").includes("  userMetric: '1 + 1' # keep\n"));
  assert.throws(() => badges.updateBadges("formulas: {}\n", "new"), /manually/u);
});

test("replacement treats dollar signs in project names as literal content", (): void => {
  const content = config.generateBase("Projects", [PROJECT]);
  const formula = badges.badgeFormula([paths.projectFromPath("Projects/Money $&")], {});
  const updated = badges.updateBadges(content, formula);
  assert.equal(
    (parse(updated) as { formulas: Record<string, string> }).formulas[
      badges.FORMULA_NAME
    ],
    formula,
  );
});
