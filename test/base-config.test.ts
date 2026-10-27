import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";
import * as config from "../src/tasks/base-config";
import * as paths from "../src/projects/paths";
import * as tasks from "../src/tasks/model";
import { applyProposal } from "../src/tasks/base-service";
import { TFile } from "./obsidian";
import type { Vault } from "obsidian";

const PROJECT = paths.projectFromPath("Projects/PFAS");

test("one Base has shared tasks and distinct editable status views", (): void => {
  const content = config.generateBase("Projects", [PROJECT]);
  assert(config.hasView(content));
  assert(config.hasView(content, PROJECT));
  const views = config.readViews(content);
  assert.deepEqual(views[1]?.groupOrder, [...tasks.STATUSES]);
  assert.deepEqual(views[1]?.groupBy, { property: "note.status", direction: "ASC" });
});

test("safe view append preserves comments, unknown keys and trailing top-level sections", (): void => {
  const content =
    "# custom\nviews:\n  - type: table\n    name: My table # keep\ncustom:\n  preserved: yes\n";
  const updated = config.appendViews(content, config.viewFragment(PROJECT));
  assert(
    updated.startsWith("# custom\nviews:\n  - type: table\n    name: My table # keep\n"),
  );
  assert(updated.endsWith("custom:\n  preserved: yes\n"));
  assert(config.hasView(updated, PROJECT));
  assert.equal(config.readViews(updated).length, 2);
});

test("complex/invalid/duplicate YAML and conflicting views fail without a rewrite", (): void => {
  assert.throws(() => config.appendViews("views: []\n", config.viewFragment(PROJECT)));
  for (const content of [
    "[]",
    "views: [",
    "views: [{name: x}, {name: x}]",
    "views:\nviews: []\n",
  ]) {
    assert.throws(() => config.readViews(content));
  }
  assert.throws(() =>
    config.hasView("views: [{type: kanban, name: 'Project: PFAS'}]", PROJECT),
  );
});

test("expression strings and YAML are escaped independently", (): void => {
  const project = paths.projectFromPath("Projects/Café's work");
  const content = config.generateBase("School Projects", [project]);
  assert(config.hasView(content, project));
  assert.doesNotThrow(() => parse(content));
  assert.equal(config.projectFilter('a" or true'), 'note.project == "a\\\" or true"');
});

test("atomic commit aborts when a Base changed after its preview", async (): Promise<void> => {
  const file = new TFile("Projects/Tasks.base");
  let saved = "User edited since preview";
  const vault = {
    getAbstractFileByPath: (): TFile => file,
    process: async (
      _file: unknown,
      transform: (text: string) => string,
    ): Promise<string> => {
      saved = transform(saved);
      return saved;
    },
  } as unknown as Vault;
  await assert.rejects(
    applyProposal(vault, {
      path: file.path,
      original: "old",
      updated: "new",
      fragment: "fragment",
      explanation: "test proposal",
    }),
    /changed after preview/u,
  );
  assert.equal(saved, "User edited since preview");
});
