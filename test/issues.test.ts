import { test } from "node:test";
import assert from "node:assert/strict";
import { newIssueUrl } from "../src/support/issues";

test("Report Issue opens the explicit repository's new issue page", (): void => {
  assert.equal(
    newIssueUrl("example/subject-notebook"),
    "https://github.com/example/subject-notebook/issues/new",
  );
  assert.equal(
    newIssueUrl("https://github.com/example/subject-notebook.git/"),
    "https://github.com/example/subject-notebook/issues/new",
  );
});

test("Report Issue rejects missing repositories and unexpected URL destinations", (): void => {
  for (const value of [
    "",
    "owner",
    "https://evil.example/owner/repo",
    "https://github.com@evil.example/owner/repo",
    "https://github.com/owner/repo?query=1",
    "https://github.com/owner/repo/issues",
    "javascript:alert(1)",
  ]) {
    assert.throws(() => newIssueUrl(value), value);
  }
});
