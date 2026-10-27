import { test } from "node:test";
import assert from "node:assert/strict";
import { notebookForFile } from "../src/projects/notebooks";
import { projectFromPath } from "../src/projects/paths";

test("notebook identity follows folder ancestry independently of main context", (): void => {
  const blue = projectFromPath("Projects/Blue");
  const green = projectFromPath("Projects/Green");
  const archived = projectFromPath("Projects Archive/Old");
  const notebooks = new Map(
    [blue, green, archived].map((item) => [item.folderPath, item]),
  );
  assert.equal(notebookForFile("Projects/Green/Reference/Nested.md", notebooks), green);
  assert.equal(notebookForFile("Projects/Blue/Log.md", notebooks), blue);
  assert.equal(notebookForFile("Projects Archive/Old/Log.md", notebooks), archived);
  assert.equal(notebookForFile("Projects/Greenish/Note.md", notebooks), undefined);
  assert.equal(notebookForFile("Home.md", notebooks), undefined);
});
