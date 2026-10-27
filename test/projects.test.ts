import { test } from "node:test";
import assert from "node:assert/strict";
import * as paths from "../src/projects/paths";
import { assertProjectName, discoverProjects } from "../src/projects/discovery";
import { TFile, TFolder } from "./obsidian";
import { ensureProjectFiles } from "../src/projects/files";
import type { Vault } from "obsidian";

function fakeVault(): {
  vault: Vault;
  content: Map<string, string>;
  entries: Map<string, TFile | TFolder>;
} {
  const content = new Map<string, string>();
  const entries = new Map<string, TFile | TFolder>();
  const vault = {
    getAbstractFileByPath: (path: string): TFile | TFolder | undefined =>
      entries.get(path),
    createFolder: async (path: string): Promise<TFolder> => {
      const folder = new TFolder(path);
      entries.set(path, folder);
      return folder;
    },
    create: async (path: string, text: string): Promise<TFile> => {
      if (entries.has(path)) throw new Error("Already exists");
      const file = new TFile(path);
      entries.set(path, file);
      content.set(path, text);
      return file;
    },
  } as unknown as Vault;
  return { vault, content, entries };
}

test("names and directory paths reject traversal, link separators, and reserved names", (): void => {
  for (const name of [
    "",
    " PFAS",
    "PFAS.",
    "..",
    "a/b",
    "a\\b",
    "CON",
    "x#y",
    "[x]",
    "bad\u0000",
  ]) {
    assert.throws(() => paths.validateName(name), name);
  }
  for (const path of ["/Projects", "../Projects", "a/../Projects", "Projects/", "a//b"]) {
    assert.throws(() => paths.validateDirectory(path), path);
  }
  assert.equal(paths.validateDirectory("Work/Projects"), "Work/Projects");
});

test("existing project adoption is exact; case and log-name collisions fail", (): void => {
  const projects = [paths.projectFromPath("Projects/PFAS")];
  assert.equal(assertProjectName("PFAS", projects), "PFAS");
  assert.throws(() => assertProjectName("pfas", projects));
  assert.throws(() => assertProjectName("Log", projects));
  assert.equal(paths.collisionKey("Cafe\u0301"), paths.collisionKey("Café"));
});

test("creation preserves existing files and repairs only missing notes", async (): Promise<void> => {
  const { vault, content, entries } = fakeVault();
  const project = paths.projectFromPath("Projects/PFAS");
  await ensureProjectFiles(vault, project);
  assert.deepEqual(
    [...entries.keys()],
    ["Projects", "Projects/PFAS", project.logPath, project.homepagePath],
  );
  content.set(project.logPath, "My existing notebook");
  entries.delete(project.homepagePath);
  await ensureProjectFiles(vault, project);
  assert.equal(content.get(project.logPath), "My existing notebook");
  assert(entries.get(project.homepagePath) instanceof TFile);
});

test("discovery inspects immediate folders and preserves case variants", (): void => {
  const { vault, entries } = fakeVault();
  const root = new TFolder("Projects");
  root.children = [
    new TFolder("Projects/PFAS"),
    new TFolder("Projects/pfas"),
    new TFile("Projects/Tasks.base"),
  ];
  entries.set(root.path, root);
  assert.deepEqual(
    discoverProjects(vault, "Projects")
      .map((project) => project.name)
      .sort(),
    ["PFAS", "pfas"],
  );
});

test("disabled homepage does not create a note or read its template; enabling it creates once", async (): Promise<void> => {
  const { vault, content, entries } = fakeVault();
  const project = paths.projectFromPath("Projects/Lean");
  let reads = 0;
  const homepageContent = async (): Promise<string> => {
    reads += 1;
    return "Template content\n";
  };
  await ensureProjectFiles(vault, project, { homepage: false, homepageContent });
  assert.equal(entries.has(project.homepagePath), false);
  assert.equal(reads, 0);
  await ensureProjectFiles(vault, project, { homepageContent });
  await ensureProjectFiles(vault, project, { homepageContent });
  assert.equal(reads, 1);
  assert.equal(content.get(project.homepagePath), "Template content\n");
});
