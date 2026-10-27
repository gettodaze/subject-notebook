import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, getFrontMatterInfo } from "./obsidian";
import { TransferFixture } from "./transfer-fixture";
import { prepareTransfer, executeTransfer } from "../src/projects/transfer";
import { projectFromPath } from "../src/projects/paths";

const SOURCE = projectFromPath("Projects/Scratch");
const TARGET = "Projects/PFAS/Scratch";
const TASK =
  "---\ntype: task\nproject: Scratch\nstatus: Today\n---\n\nTask body stays.\n";

function fixture(): TransferFixture {
  const result = new TransferFixture();
  result.folder("Projects/PFAS");
  result.file(SOURCE.logPath, "Source log stays separate.\n");
  result.file(SOURCE.homepagePath, "Source homepage.\n");
  result.file(`${SOURCE.folderPath}/Work.md`, TASK);
  result.file(`${SOURCE.folderPath}/Nested/Notes.md`, "Ordinary nested notes.\n");
  result.file("Projects/PFAS/Log.md", "Target log stays unchanged.\n");
  return result;
}

test("combine moves into a subfolder, reassigns task project, and preserves status, body, and both logs", async (): Promise<void> => {
  const data = fixture();
  const plan = await prepareTransfer(data.vault, SOURCE, TARGET, "PFAS");
  assert.equal(plan.taskChanges.length, 1);
  await executeTransfer(data.vault, data.fileManager, plan);
  assert.equal(data.entries.has(SOURCE.folderPath), false);
  assert(data.entries.has(`${TARGET}/Nested/Notes.md`));
  const task = data.contents.get(
    data.entries.get(`${TARGET}/Work.md`) as import("./obsidian").TFile,
  )!;
  assert.deepEqual(parseYaml(getFrontMatterInfo(task).frontmatter), {
    type: "task",
    project: "PFAS",
    status: "Today",
  });
  assert(task.endsWith("\nTask body stays.\n"));
  assert.equal(
    data.contents.get(data.entries.get(`${TARGET}/Log.md`) as import("./obsidian").TFile),
    "Source log stays separate.\n",
  );
  assert.equal(
    data.contents.get(
      data.entries.get("Projects/PFAS/Log.md") as import("./obsidian").TFile,
    ),
    "Target log stays unchanged.\n",
  );
});

test("archive is a folder move without reading or changing note contents", async (): Promise<void> => {
  const data = fixture();
  const plan = await prepareTransfer(data.vault, SOURCE, "Projects Archive/Scratch");
  assert.equal(data.reads, 0);
  assert.equal(plan.taskChanges.length, 0);
  await executeTransfer(data.vault, data.fileManager, plan);
  const file = data.entries.get(
    "Projects Archive/Scratch/Work.md",
  ) as import("./obsidian").TFile;
  assert.equal(data.contents.get(file), TASK);
});

test("an existing destination, including a case variant, is never overwritten", async (): Promise<void> => {
  const data = fixture();
  data.folder("Projects/PFAS/scratch");
  await assert.rejects(
    prepareTransfer(data.vault, SOURCE, TARGET, "PFAS"),
    /already exists/u,
  );
  assert(data.entries.has(SOURCE.logPath));
});

test("changes after preview abort before moving or updating tasks", async (): Promise<void> => {
  const data = fixture();
  const plan = await prepareTransfer(data.vault, SOURCE, TARGET, "PFAS");
  data.file(`${SOURCE.folderPath}/New note.md`, "New content");
  await assert.rejects(
    executeTransfer(data.vault, data.fileManager, plan),
    /changed after preview/u,
  );
  assert.equal(
    data.contents.get(
      data.entries.get(`${SOURCE.folderPath}/Work.md`) as import("./obsidian").TFile,
    ),
    TASK,
  );
});

test("rename failure rolls back task project changes without altering the task body", async (): Promise<void> => {
  const data = fixture();
  const plan = await prepareTransfer(data.vault, SOURCE, TARGET, "PFAS");
  data.failRename = true;
  await assert.rejects(executeTransfer(data.vault, data.fileManager, plan), /reverted/u);
  const file = data.entries.get(
    `${SOURCE.folderPath}/Work.md`,
  ) as import("./obsidian").TFile;
  assert.equal(data.contents.get(file), TASK);
  assert(data.entries.has(SOURCE.logPath));
});

test("a write that commits before reporting failure is also rolled back", async (): Promise<void> => {
  const data = fixture();
  const plan = await prepareTransfer(data.vault, SOURCE, TARGET, "PFAS");
  data.failAfterWrite = true;
  await assert.rejects(executeTransfer(data.vault, data.fileManager, plan), /reverted/u);
  assert.equal(
    data.contents.get(plan.taskChanges[0]!.file as unknown as import("./obsidian").TFile),
    TASK,
  );
  assert(data.entries.has(SOURCE.logPath));
});

test("malformed task project properties block combine but do not block archive", async (): Promise<void> => {
  const data = fixture();
  const task = data.entries.get(
    `${SOURCE.folderPath}/Work.md`,
  ) as import("./obsidian").TFile;
  data.write(task, TASK.replace("project: Scratch", "project: [custom, schema]"));
  await assert.rejects(prepareTransfer(data.vault, SOURCE, TARGET, "PFAS"), /non-text/u);
  await assert.doesNotReject(
    prepareTransfer(data.vault, SOURCE, "Projects Archive/Scratch"),
  );
});

test("rollback preserves a concurrently changed project property and reverts only our own updates", async (): Promise<void> => {
  const data = fixture();
  const second = data.file(`${SOURCE.folderPath}/Second.md`, TASK);
  const plan = await prepareTransfer(data.vault, SOURCE, TARGET, "PFAS");
  data.beforeUpdate = (file): void => {
    if (file !== second) return;
    data.beforeUpdate = undefined;
    data.write(second, TASK.replace("project: Scratch", "project: UserChangedProject"));
  };
  await assert.rejects(
    executeTransfer(data.vault, data.fileManager, plan),
    /need review/u,
  );
  assert.equal(data.text(`${SOURCE.folderPath}/Work.md`), TASK);
  assert(
    data.text(`${SOURCE.folderPath}/Second.md`).includes("project: UserChangedProject"),
  );
  assert(data.entries.has(SOURCE.logPath));
});

test("a task without a project property joins the target without changing status", async (): Promise<void> => {
  const data = fixture();
  const file = data.file(
    `${SOURCE.folderPath}/Unassigned.md`,
    TASK.replace("project: Scratch\n", ""),
  );
  const plan = await prepareTransfer(data.vault, SOURCE, TARGET, "PFAS");
  await executeTransfer(data.vault, data.fileManager, plan);
  const metadata = parseYaml(getFrontMatterInfo(data.contents.get(file)!).frontmatter);
  assert.deepEqual(metadata, { type: "task", project: "PFAS", status: "Today" });
});
