import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const DEBUGGING_URL = "http://127.0.0.1:9227";
export const TEST_VAULT_PATH =
  "/tmp/subject-notebook-validation/subject-notebook-test-vault";
const TASK_TITLE = "Investigate pipeline";
const TASK_PATH = `Projects/PFAS/${TASK_TITLE}.md`;
const LOG_PATH = "Projects/PFAS/Log.md";
const BASE_PATH = "Projects/Tasks.base";
const TIMEOUT_MS = 10000;

async function main() {
  const browser = await chromium.connectOverCDP(DEBUGGING_URL);
  try {
    const page = browser.contexts()[0]?.pages()[0];
    if (!page) throw new Error("No disposable Obsidian window found.");
    const path = await page.evaluate(() => window.app?.vault.adapter.getBasePath());
    assert.equal(path, TEST_VAULT_PATH, "Refusing to modify any other vault");
    await page.setViewportSize({ width: 1920, height: 1080 });
    if (process.argv.includes("--rename-test-badge")) {
      // Upgrade only the guarded disposable fixture from the earlier development build.
      await page.evaluate(async () => {
        const file = window.app.vault.getFileByPath("Projects/Tasks.base");
        await window.app.vault.process(file, (content) => {
          if (
            !content.includes(
              "# Subject Notebook project badge (managed; review changes in settings)",
            )
          )
            throw new Error("Refusing to change a non-fixture Base");
          return content.replaceAll("subjectNotebookProject", "Project");
        });
      });
    }
    if (process.argv.includes("--reload")) {
      await page.reload();
      await page.locator(".subject-notebook-status").waitFor();
    }
    page.on("pageerror", (error) => console.error("OBSIDIAN PAGE ERROR", error.message));
    if (process.argv.includes("--diagnose-drag")) await diagnoseDrag(page);
    else if (process.argv.includes("--smoke")) await smoke(page);
    else console.log((await page.locator("body").innerText()).slice(0, 8000));
  } finally {
    await browser.close();
  }
}

async function command(page, name) {
  await page.keyboard.press("Control+p");
  await page.locator(".prompt-input").fill(`Subject Notebook: ${name}`);
  await page.locator(".suggestion-item").first().click();
}

async function switchTo(page, name) {
  await command(page, "Switch project");
  await page.locator(".prompt-input").fill(name);
  await page.locator(".suggestion-item").first().click();
  await finishDialogs(page);
  await page.locator(`.bases-view[data-view-name="Project: ${name}"]`).waitFor();
  await page.waitForFunction(
    (name) => window.app.workspace.getActiveFile()?.path === `Projects/${name}/Log.md`,
    name,
  );
}

async function create(page, commandName, name) {
  await command(page, commandName);
  await page.locator(".modal input[type=text]").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await finishDialogs(page);
}

async function finishDialogs(page) {
  const labels = ["Apply previewed changes", "Arrange project panes"];
  for (let step = 0; step < 4; step++) {
    await page.waitForFunction((labels) => {
      const done =
        document.querySelectorAll(".modal").length === 0 &&
        document.querySelector(".subject-notebook-status")?.getAttribute("aria-busy") !==
          "true";
      return (
        done ||
        [...document.querySelectorAll(".modal button")].some((button) =>
          labels.includes(button.textContent),
        )
      );
    }, labels);
    let handled = false;
    for (const label of labels) {
      const button = page.getByRole("button", { name: label, exact: true });
      if (await button.count()) {
        await button.click();
        handled = true;
        break;
      }
    }
    if (!handled) return;
  }
  throw new Error("Too many test confirmation dialogs.");
}

function card(page, title = TASK_TITLE) {
  return page
    .locator(".subject-notebook-planner-content .bases-kanban-card")
    .filter({ hasText: title });
}

function column(page, status) {
  return page.locator(".subject-notebook-planner-content .bases-kanban-column").filter({
    has: page.locator(".bases-group-value", { hasText: new RegExp(`^${status}$`) }),
  });
}

async function assertGeometry(page) {
  const state = await page.evaluate(() => {
    const leaves = [];
    window.app.workspace.iterateAllLeaves((leaf) => {
      const rect = leaf.view.containerEl.getBoundingClientRect();
      leaves.push({
        type: leaf.view.getViewType(),
        file: leaf.view.file?.path,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      });
    });
    return leaves;
  });
  const log = state.find((leaf) => leaf.file === LOG_PATH && leaf.width > 0);
  const home = state.find(
    (leaf) => leaf.file === "Projects/PFAS/PFAS.md" && leaf.width > 0,
  );
  const planner = state.find((leaf) => leaf.type === "subject-notebook-planner");
  assert(log && home && planner);
  assert(log.x < home.x && log.y === home.y && planner.y > log.y);
  assert.equal(planner.width, log.width + home.width);
  console.log("PASS T-shaped canonical layout", JSON.stringify({ log, home, planner }));
}

async function assertLog(page) {
  const state = await page.evaluate(() => {
    const editor = window.app.workspace.activeEditor?.editor;
    if (!editor) return null;
    return {
      cursor: editor.getCursor(),
      line: editor.lastLine(),
      ch: editor.getLine(editor.lastLine()).length,
    };
  });
  assert(state);
  assert.deepEqual(state.cursor, { line: state.line, ch: state.ch });
  // Editor transactions are persisted by native autosave, not by the plugin.
  await page.waitForFunction(
    async (path) =>
      /^## \d{4}-\d{2}-\d{2}$/m.test(
        await window.app.vault.read(window.app.vault.getFileByPath(path)),
      ),
    LOG_PATH,
  );
  const log = await readFile(`${TEST_VAULT_PATH}/${LOG_PATH}`, "utf8");
  assert.equal(log.match(/^## \d{4}-\d{2}-\d{2}$/gm)?.length, 1);
}

async function dragToToday(page) {
  await card(page).waitFor();
  await card(page).dragTo(column(page, "Today"), {
    sourcePosition: { x: 20, y: 15 },
    targetPosition: { x: 60, y: 70 },
  });
  await column(page, "Today").getByText(TASK_TITLE, { exact: true }).waitFor();
  await page.waitForFunction(
    async (path) => {
      return (await window.app.vault.read(window.app.vault.getFileByPath(path))).includes(
        "status: Today",
      );
    },
    TASK_PATH,
    { timeout: TIMEOUT_MS },
  );
  console.log("PASS native drag updates Markdown status to Today");
}

async function diagnoseDrag(page) {
  await page.evaluate(() => {
    window.subjectNotebookDragTrace = [];
    for (const type of ["dragstart", "dragover", "drop", "dragend"]) {
      document.addEventListener(
        type,
        (event) => {
          window.subjectNotebookDragTrace.push({
            type,
            x: event.clientX,
            y: event.clientY,
            target: event.target.className,
            column: event.target
              .closest?.(".bases-kanban-column")
              ?.querySelector(".bases-group-value")?.textContent,
          });
        },
        { capture: true },
      );
    }
  });
  console.log("CARD", await card(page).evaluate((element) => element.outerHTML));
  await card(page).dragTo(column(page, "Today"), {
    sourcePosition: { x: 20, y: 15 },
    targetPosition: { x: 60, y: 70 },
  });
  console.log("TRACE", await page.evaluate(() => window.subjectNotebookDragTrace));
  console.log("TASK", await readFile(`${TEST_VAULT_PATH}/${TASK_PATH}`, "utf8"));
}

async function assertBadge(page) {
  await card(page).waitFor();
  const colors = await card(page)
    .locator("span")
    .evaluateAll((elements) => elements.map((element) => element.style.backgroundColor));
  assert(colors.includes("rgb(45, 72, 65)"));
}

async function assertPlannerContrast(page) {
  const colors = await column(page, "Backlog").evaluate((element) => ({
    foreground: getComputedStyle(element.querySelector(".bases-group-value")).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  const first = luminance(colors.foreground);
  const second = luminance(colors.background);
  const contrast = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  assert(contrast >= 4.5, `Native planner text contrast must be readable: ${contrast}`);
  console.log("PASS native planner text contrast", contrast.toFixed(2));
}

function luminance(color) {
  const channels = color
    .match(/\d+/g)
    .slice(0, 3)
    .map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

async function smoke(page) {
  if (
    await page
      .getByRole("button", { name: "Apply previewed changes", exact: true })
      .count()
  ) {
    await page
      .getByRole("button", { name: "Apply previewed changes", exact: true })
      .click();
    await page.waitForFunction(() => document.querySelectorAll(".modal").length === 0);
  }
  const exists = await page.evaluate(
    () => !!window.app.vault.getFolderByPath("Projects/PFAS"),
  );
  if (!exists) await create(page, "New project", "PFAS");
  else await switchTo(page, "PFAS");
  await page.locator('.bases-view[data-view-name="Project: PFAS"]').waitFor();
  await assertGeometry(page);
  await assertPlannerContrast(page);
  await assertLog(page);
  if (
    !(await page.evaluate((path) => !!window.app.vault.getFileByPath(path), TASK_PATH))
  ) {
    await create(page, "New project task", TASK_TITLE);
  }
  const originalBase = await readFile(`${TEST_VAULT_PATH}/${BASE_PATH}`, "utf8");
  await dragToToday(page);
  await command(page, "Open Home");
  await page.locator('.bases-view[data-view-name="All Projects"]').waitFor();
  await column(page, "Today").getByText(TASK_TITLE, { exact: true }).waitFor();
  assert.equal(
    await page
      .locator(".subject-notebook-planner-content.subject-notebook-project")
      .count(),
    0,
  );
  await assertBadge(page);
  console.log("PASS Home displays the same Today task with exact Forest Teal badge");
  await switchTo(page, "PFAS");
  await assertLog(page);
  assert.equal(await readFile(`${TEST_VAULT_PATH}/${BASE_PATH}`, "utf8"), originalBase);
  assert(
    (await readFile(`${TEST_VAULT_PATH}/${TASK_PATH}`, "utf8")).includes("status: Today"),
  );
  console.log("PASS repeat switch preserves daily heading, task status, and Base bytes");
  await reportIssueCheck(page);
  await page.screenshot({ path: "/tmp/subject-notebook-project.png" });
  if (process.argv.includes("--extended")) await extended(page);
}

async function reportIssueCheck(page) {
  await page.evaluate(() => {
    window.subjectNotebookOriginalOpen = window.open;
    window.subjectNotebookOpenedLinks = [];
    window.open = (url) => {
      window.subjectNotebookOpenedLinks.push(String(url));
      return null;
    };
  });
  try {
    await command(page, "Report Issue");
    assert.deepEqual(await page.evaluate(() => window.subjectNotebookOpenedLinks), [
      "https://github.com/gettodaze/subject-notebook/issues/new",
    ]);
    console.log(
      "PASS Report Issue opens the correct repository URL (intercepted; no issue submitted)",
    );
  } finally {
    await page.evaluate(() => {
      window.open = window.subjectNotebookOriginalOpen;
      delete window.subjectNotebookOriginalOpen;
    });
  }
}

async function extended(page) {
  const exists = await page.evaluate(
    () => !!window.app.vault.getFolderByPath("Projects/ItR"),
  );
  if (!exists) await create(page, "New project", "ItR");
  else await switchTo(page, "ItR");
  await page.locator('.bases-view[data-view-name="Project: ItR"]').waitFor();
  assert.equal(await card(page).count(), 0);
  await switchTo(page, "PFAS");
  await assertBadge(page);
  await page.evaluate(async () => {
    const base = window.app.vault.getFileByPath("Projects/Tasks.base");
    await window.app.workspace.getLeaf("tab").openFile(base);
  });
  await page.locator('.bases-view[data-view-name="All Projects"]').waitFor();
  assert.equal(
    await page.locator('.bases-view[data-view-name="Project: PFAS"]').count(),
    1,
  );
  console.log("PASS ItR filtering and two simultaneous native view selections");
  await switchTo(page, "PFAS");
  await restartCheck(page);
}

async function restartCheck(page) {
  await page.waitForFunction(async () => {
    const content = await window.app.vault.adapter.read(".obsidian/workspace.json");
    return content.includes('"projectPath": "Projects/PFAS"');
  });
  await page.reload();
  await page.locator('.bases-view[data-view-name="Project: PFAS"]').waitFor();
  await page.locator(".subject-notebook-status", { hasText: "PFAS" }).waitFor();
  const count = await page.evaluate(() => {
    let count = 0;
    window.app.workspace.iterateAllLeaves(() => count++);
    return count;
  });
  await switchTo(page, "ItR");
  await switchTo(page, "PFAS");
  assert.equal(
    await page.evaluate(() => {
      let count = 0;
      window.app.workspace.iterateAllLeaves(() => count++);
      return count;
    }),
    count,
  );
  console.log("PASS startup restores planner context and reuses existing leaves");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();

export { command, create, switchTo, finishDialogs };
