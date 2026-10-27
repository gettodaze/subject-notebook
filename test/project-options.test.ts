import { test } from "node:test";
import assert from "node:assert/strict";
import * as settings from "../src/settings/model";
import * as features from "../src/settings/features";
import * as paths from "../src/projects/paths";
import { scratchName } from "../src/projects/scratch";
import { renderTemplate } from "../src/projects/templates";
import { moveProjectPreferences } from "../src/settings/project-state";

test("older settings gain safe independent defaults for scratch, archive, and optional panes", (): void => {
  const first = settings.parseSettings({ projectsDir: "Work/Projects" });
  assert.equal(first.archiveDir, "Work/Projects Archive");
  assert.deepEqual(features.projectFeatures(first, "Work/Projects/PFAS"), {
    homepage: true,
    kanban: true,
  });
  assert.deepEqual(features.homeFeatures(first), { homepage: false, kanban: true });
  first.scratchProjectPaths.push("Work/Projects/Test");
  assert.deepEqual(settings.defaultSettings().scratchProjectPaths, []);
});

test("project and Home toggles are independent, and explicit Home context survives settings reload", (): void => {
  const parsed = settings.parseSettings({
    homeShowHomepage: false,
    homeShowKanban: false,
    lastProjectPath: null,
    projectFeaturesByPath: { "Projects/PFAS": { homepage: false, kanban: true } },
  });
  assert.deepEqual(features.projectFeatures(parsed, "Projects/PFAS"), {
    homepage: false,
    kanban: true,
  });
  assert.deepEqual(features.homeFeatures(parsed), { homepage: false, kanban: false });
  assert.equal(parsed.lastProjectPath, null);
  assert.equal(settings.parseSettings({}).lastProjectPath, undefined);
});

test("archive directory validation prevents nested or case-variant active roots", (): void => {
  for (const archive of ["Projects", "Projects/Archive", "projects/archive", "Work"]) {
    assert.throws(() =>
      paths.validateSeparateDirectories(
        archive === "Work" ? "Work/Projects" : "Projects",
        archive,
      ),
    );
  }
  assert.doesNotThrow(() =>
    paths.validateSeparateDirectories("Projects", "Projects Archive"),
  );
});

test("templates substitute only known tokens, once, without interpreting inserted values", (): void => {
  const result = renderTemplate("# {{project}}\n{{log}}\n{{date}}\n{{future}}", {
    project: "Money $& {{date}}",
    log: "Projects/Money/Log.md",
    date: new Date(2026, 9, 26),
  });
  assert.equal(
    result,
    "# Money $& {{date}}\n[[Projects/Money/Log.md]]\n2026-10-26\n{{future}}",
  );
});

test("scratch default names are portable and avoid collisions without polling", (): void => {
  const now = new Date(2026, 9, 26, 17, 45);
  const name = scratchName(now, []);
  assert.equal(name, "Scratch 2026-10-26 17-45");
  assert.equal(
    scratchName(now, [paths.projectFromPath(`Projects/${name}`)]),
    `${name} (2)`,
  );
});

test("palette, layout preferences, and scratch markers follow archive and restore moves", (): void => {
  const value = settings.defaultSettings();
  value.scratchProjectPaths = ["Projects/Scratch"];
  value.projectFeaturesByPath["Projects/Scratch"] = { homepage: false, kanban: true };
  moveProjectPreferences(
    value,
    "Projects/Scratch",
    "Projects Archive/Scratch",
    "forest-teal",
  );
  assert.equal(features.isScratch(value, "Projects Archive/Scratch"), true);
  moveProjectPreferences(value, "Projects Archive/Scratch", "Projects/Scratch", "slate");
  assert.equal(value.palettesByProjectPath["Projects/Scratch"], "forest-teal");
  assert.deepEqual(features.projectFeatures(value, "Projects/Scratch"), {
    homepage: false,
    kanban: true,
  });
});
