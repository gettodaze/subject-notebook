import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSettings } from "../src/settings/model";
import { resolvePalette, foreground } from "../src/themes/palettes";

test("invalid saved settings are validated and defaults are independent", (): void => {
  const settings = parseSettings({
    projectsDir: "../bad",
    defaultTaskStatus: "oops",
    projectStyling: "yes",
  });
  assert.equal(settings.projectsDir, "Projects");
  assert.equal(settings.defaultTaskStatus, "Backlog");
  assert.equal(settings.projectStyling, true);
  settings.palettesByProjectPath.x = "slate";
  assert.equal(parseSettings(null).palettesByProjectPath.x, undefined);
});

test("palette assignments accept validated hex/presets only", (): void => {
  const settings = parseSettings({
    palettesByProjectPath: { PFAS: "#2d4841", bad: "url(evil)" },
  });
  assert.equal(settings.palettesByProjectPath.PFAS, "#2d4841");
  assert.equal(settings.palettesByProjectPath.bad, undefined);
  assert.equal(resolvePalette("PFAS").background, "#2d4841");
  assert.equal(foreground("#ffffff"), "#000000");
  assert.equal(foreground("#000000"), "#ffffff");
});
