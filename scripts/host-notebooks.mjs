import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  DEBUGGING_URL,
  TEST_VAULT_PATH,
  command,
  create,
  switchTo,
  finishDialogs,
} from "./host-test.mjs";

async function main() {
  const browser = await chromium.connectOverCDP(DEBUGGING_URL);
  try {
    const page = browser
      .contexts()[0]
      .pages()
      .find((candidate) => candidate.url().startsWith("app://"));
    assert(page);
    assert.equal(
      await page.evaluate(() => window.app.vault.adapter.getBasePath()),
      TEST_VAULT_PATH,
    );
    await page.setViewportSize({ width: 1920, height: 1080 });
    if (!(await page.evaluate(() => !!window.app.vault.getFolderByPath("Projects/Lisa"))))
      await create(page, "New project", "Lisa");
    await switchTo(page, "PFAS");
    await page.evaluate(async () => {
      const file = window.app.vault.getFileByPath("Projects/Lisa/Log.md");
      const leaf = window.app.workspace.getMostRecentLeaf();
      await leaf.openFile(file, { active: true });
    });
    await page.waitForFunction(() => {
      const view = window.app.workspace.activeEditor;
      return (
        view?.file?.path === "Projects/Lisa/Log.md" &&
        view.containerEl.style.getPropertyValue("--sn-background") === "#062711"
      );
    });
    await page.waitForFunction(() => {
      const editor = window.app.workspace.activeEditor?.editor;
      return (
        editor &&
        editor.getCursor().line === editor.lastLine() &&
        editor.getCursor().ch === editor.getLine(editor.lastLine()).length
      );
    });
    const status = page.locator(".subject-notebook-status");
    assert((await status.innerText()).includes("PFAS"));
    assert.equal(
      await status.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(45, 72, 65)",
    );
    const title = `Reference context ${Date.now()}`;
    await create(page, "New project task", title);
    assert(
      await page.evaluate(
        (path) => !!window.app.vault.getFileByPath(path),
        `Projects/PFAS/${title}.md`,
      ),
    );
    await page.evaluate(async () => {
      await window.app.workspace
        .getMostRecentLeaf()
        .setViewState({ type: "empty", active: true });
    });
    await page.waitForFunction(
      () => window.app.workspace.getActiveFile()?.path === "Projects/PFAS/Log.md",
    );
    console.log(
      "PASS green reference keeps PFAS main color/task destination; empty managed editor returns to PFAS Log",
    );
    await command(page, "Restore project layout");
    await finishDialogs(page);
    await page.evaluate(async () => {
      const file = window.app.vault.getFileByPath("Projects/Lisa/Log.md");
      await window.app.workspace.getMostRecentLeaf().openFile(file, { active: true });
    });
    await command(page, "Set main notebook from current note");
    await page.locator(".subject-notebook-status", { hasText: "Lisa" }).waitFor();
    assert.equal(
      await status.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(6, 39, 17)",
    );
    await command(page, "Restore project layout");
    await finishDialogs(page);
    await page.locator('.bases-view[data-view-name="Project: Lisa"]').waitFor();
    await switchTo(page, "PFAS");
    await page.screenshot({ path: "/tmp/subject-notebook-project.png" });
    console.log("PASS explicit main-notebook selection and canonical restore");
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
