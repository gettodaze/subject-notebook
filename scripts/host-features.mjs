import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  DEBUGGING_URL,
  TEST_VAULT_PATH,
  command,
  create,
  switchTo,
  finishDialogs,
} from "./host-test.mjs";

const DATA_PATH = ".obsidian/plugins/subject-notebook/data.json";
const TEMPLATE_PROJECT = "Template Trial";
const SCRATCH_PROJECT = "Scratch Trial";
const ARCHIVE_PROJECT = "Archive Trial";
const TRASH_PROJECT = "Scratch Trash Trial";

async function main() {
  const browser = await chromium.connectOverCDP(DEBUGGING_URL);
  try {
    const page = browser.contexts()[0]?.pages()[0];
    assert(page);
    assert.equal(
      await page.evaluate(() => window.app.vault.adapter.getBasePath()),
      TEST_VAULT_PATH,
    );
    await page.setViewportSize({ width: 1920, height: 1080 });
    if (process.argv.includes("--reload")) {
      await page.reload();
      await page.locator(".subject-notebook-status").waitFor();
    }
    page.on("pageerror", (error) => console.error("OBSIDIAN PAGE ERROR", error.message));
    if (process.argv.includes("--inspect")) {
      console.log((await page.locator("body").innerText()).slice(0, 10000));
      return;
    }
    await templateAndLayoutChecks(page);
    await combineCheck(page);
    await archiveCheck(page);
    await trashCheck(page);
    await switchTo(page, "PFAS");
    console.log(
      "PASS all optional-layout, template, scratch, combine, archive, and trash checks",
    );
  } finally {
    await browser.close();
  }
}

async function openSettings(page) {
  await page.evaluate(() => window.app.setting.open());
  await page.waitForFunction(() => !!window.app.setting);
  const settings = await settingsPage(page);
  await settings
    .locator(".vertical-tab-nav-item")
    .filter({ hasText: /^Subject Notebook$/ })
    .click();
  await settings.getByText("Projects directory", { exact: true }).waitFor();
}

async function settingsPage(page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const settings = page
      .context()
      .pages()
      .find((candidate) => candidate !== page && candidate.url() === "about:blank");
    if (settings) return settings;
    await page.waitForTimeout(50);
  }
  throw new Error("Native settings window did not open");
}

async function closeSettings(page) {
  await (await settingsPage(page)).close();
  await page.bringToFront();
}

function row(page, name) {
  const settings = page
    .context()
    .pages()
    .find((candidate) => candidate !== page && candidate.url() === "about:blank");
  assert(settings);
  return settings.locator(".setting-item").filter({
    has: settings.locator(".setting-item-name", { hasText: new RegExp(`^${name}$`) }),
  });
}

async function setText(page, label, key, value) {
  await row(page, label).locator("input[type=text]").fill(value);
  await row(page, label).locator("input[type=text]").press("Tab");
  await stored(page, key, value);
}

async function stored(page, key, expected, project) {
  await page.waitForFunction(
    async ({ path, key, expected, project }) => {
      try {
        const settings = JSON.parse(await window.app.vault.adapter.read(path));
        return project
          ? settings.projectFeaturesByPath?.[`Projects/${project}`]?.[key] === expected
          : settings[key] === expected;
      } catch {
        return false;
      }
    },
    { path: DATA_PATH, key, expected, project },
  );
}

async function toggle(page, label, key, value, project) {
  const control = row(page, label).locator(".checkbox-container");
  const enabled = await control.evaluate((element) =>
    element.classList.contains("is-enabled"),
  );
  if (enabled !== value) await control.click();
  await stored(page, key, value, project);
}

async function ensureFixture(page, path, content) {
  await page.evaluate(
    async ({ path, content }) => {
      const folder = path.slice(0, path.lastIndexOf("/"));
      if (!window.app.vault.getFolderByPath(folder))
        await window.app.vault.createFolder(folder);
      if (!window.app.vault.getFileByPath(path))
        await window.app.vault.create(path, content);
    },
    { path, content },
  );
}

async function templateAndLayoutChecks(page) {
  await ensureFixture(
    page,
    "Templates/Project.md",
    "# {{project}}\n\nNotebook: {{log}}\nCreated: {{date}}\n",
  );
  await ensureFixture(page, "Templates/Home.md", "# {{project}}\n\nMy landing note.\n");
  await openSettings(page);
  await setText(
    page,
    "Project homepage template",
    "projectHomepageTemplate",
    "Templates/Project.md",
  );
  await closeSettings(page);
  if (!(await exists(page, `Projects/${TEMPLATE_PROJECT}`)))
    await create(page, "New project", TEMPLATE_PROJECT);
  else await switchTo(page, TEMPLATE_PROJECT);
  const homepagePath = `Projects/${TEMPLATE_PROJECT}/${TEMPLATE_PROJECT}.md`;
  const homepage = await text(homepagePath);
  assert(homepage.includes(`# ${TEMPLATE_PROJECT}`));
  assert(homepage.includes(`[[Projects/${TEMPLATE_PROJECT}/Log.md]]`));
  for (const [homepageEnabled, kanban] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    await openSettings(page);
    await toggle(
      page,
      `${TEMPLATE_PROJECT}: Show homepage`,
      "homepage",
      homepageEnabled,
      TEMPLATE_PROJECT,
    );
    await toggle(
      page,
      `${TEMPLATE_PROJECT}: Show Kanban`,
      "kanban",
      kanban,
      TEMPLATE_PROJECT,
    );
    await closeSettings(page);
    await command(page, "Restore project layout");
    await finishDialogs(page);
    const roles = await visibleRoles(page, TEMPLATE_PROJECT);
    assert.equal(roles.homepage, homepageEnabled);
    assert.equal(roles.planner, kanban);
    assert.equal(await text(homepagePath), homepage);
  }
  console.log(
    "PASS all four project layout combinations and non-destructive homepage template",
  );
  await globalHomeChecks(page);
}

async function globalHomeChecks(page) {
  await openSettings(page);
  await setText(page, "Home landing note", "homeLandingNote", "Home.md");
  await setText(
    page,
    "Home landing note template",
    "homeLandingTemplate",
    "Templates/Home.md",
  );
  await toggle(page, "Global Home: show homepage", "homeShowHomepage", true);
  await toggle(page, "Global Home: show Kanban", "homeShowKanban", false);
  await closeSettings(page);
  await command(page, "Open Home");
  await finishDialogs(page);
  assert.equal(await text("Home.md"), "# Home\n\nMy landing note.\n");
  assert.equal(
    await page
      .locator(".subject-notebook-status")
      .evaluate((element) => element.style.getPropertyValue("--sn-main-background")),
    "transparent",
  );
  assert.equal(await page.locator(".subject-notebook-planner-content").count(), 0);
  await openSettings(page);
  await toggle(page, "Global Home: show homepage", "homeShowHomepage", false);
  await toggle(page, "Global Home: show Kanban", "homeShowKanban", true);
  await closeSettings(page);
  await command(page, "Open Home");
  await finishDialogs(page);
  await page
    .locator(
      '.subject-notebook-planner-content .bases-view[data-view-name="All Projects"]',
    )
    .waitFor();
  assert.equal(await text("Home.md"), "# Home\n\nMy landing note.\n");
  console.log("PASS global Home template, toggles, and standard theme");
}

async function visibleRoles(page, project) {
  return page.evaluate((project) => {
    let homepage = false;
    let planner = false;
    window.app.workspace.iterateAllLeaves((leaf) => {
      const visible = leaf.view.containerEl.getBoundingClientRect().width > 0;
      if (!visible) return;
      if (leaf.view.file?.path === `Projects/${project}/${project}.md`) homepage = true;
      if (leaf.view.getViewType() === "subject-notebook-planner") planner = true;
    });
    return { homepage, planner };
  }, project);
}

async function combineCheck(page) {
  if (await exists(page, `Projects/PFAS/${SCRATCH_PROJECT}`)) {
    console.log("SKIP combine fixture already moved");
    return;
  }
  if (!(await exists(page, `Projects/${SCRATCH_PROJECT}`)))
    await create(page, "New scratch project", SCRATCH_PROJECT);
  else await switchTo(page, SCRATCH_PROJECT);
  await create(page, "New project task", "Scratch task");
  const targetLog = await text("Projects/PFAS/Log.md");
  const sourceLog = await editorLog(page);
  await command(page, "Combine project into another project");
  await page.locator(".prompt-input").fill("PFAS");
  await page.locator(".suggestion-item").first().click();
  await page.getByRole("button", { name: "Review move", exact: true }).click();
  await page.getByRole("button", { name: "Move these files", exact: true }).click();
  await finishDialogs(page);
  assert.equal(await exists(page, `Projects/${SCRATCH_PROJECT}`), false);
  const task = await text(`Projects/PFAS/${SCRATCH_PROJECT}/Scratch task.md`);
  assert(task.includes("project: PFAS"));
  assert(task.includes("status: Backlog"));
  assert.equal(await text(`Projects/PFAS/${SCRATCH_PROJECT}/Log.md`), sourceLog);
  assert.equal(await text("Projects/PFAS/Log.md"), targetLog);
  await page
    .locator(".subject-notebook-planner-content .bases-kanban-card")
    .filter({ hasText: "Scratch task" })
    .waitFor();
  console.log(
    "PASS scratch combines into target subfolder; tasks follow; logs remain separate",
  );
}

async function archiveCheck(page) {
  if (
    !(await exists(page, `Projects/${ARCHIVE_PROJECT}`)) &&
    !(await exists(page, `Projects Archive/${ARCHIVE_PROJECT}`))
  )
    await create(page, "New project", ARCHIVE_PROJECT);
  if (await exists(page, `Projects/${ARCHIVE_PROJECT}`)) {
    await switchTo(page, ARCHIVE_PROJECT);
    if (!(await exists(page, `Projects/${ARCHIVE_PROJECT}/Archive task.md`)))
      await create(page, "New project task", "Archive task");
    const before = await text(`Projects/${ARCHIVE_PROJECT}/Archive task.md`);
    await command(page, "Archive project");
    await page.getByRole("button", { name: "Review archive", exact: true }).click();
    await page.getByRole("button", { name: "Move these files", exact: true }).click();
    await finishDialogs(page);
    assert.equal(
      await text(`Projects Archive/${ARCHIVE_PROJECT}/Archive task.md`),
      before,
    );
    assert.equal(await exists(page, `Projects/${ARCHIVE_PROJECT}`), false);
    await page
      .locator(
        '.subject-notebook-planner-content .bases-view[data-view-name="All Projects"]',
      )
      .waitFor();
    assert.equal(
      await page
        .locator(".subject-notebook-planner-content .bases-kanban-card")
        .filter({ hasText: "Archive task" })
        .count(),
      0,
    );
  }
  await page.evaluate(async (name) => {
    const folder = window.app.vault.getFolderByPath(`Projects Archive/${name}`);
    await window.app.fileManager.renameFile(folder, `Projects/${name}`);
  }, ARCHIVE_PROJECT);
  await switchTo(page, ARCHIVE_PROJECT);
  await page
    .locator(".subject-notebook-planner-content .bases-kanban-card")
    .filter({ hasText: "Archive task" })
    .waitFor();
  console.log(
    "PASS archive hides tasks from active board; moving folder back restores discovery and tasks",
  );
}

async function trashCheck(page) {
  const before = new Set(await listFiles(`${TEST_VAULT_PATH}/.trash`));
  if (!(await exists(page, `Projects/${TRASH_PROJECT}`)))
    await create(page, "New scratch project", TRASH_PROJECT);
  else await switchTo(page, TRASH_PROJECT);
  await create(page, "New project task", "Trash task");
  await command(page, "Trash scratch project");
  await page
    .getByRole("button", { name: "Move project to vault trash", exact: true })
    .click();
  await finishDialogs(page);
  await page.waitForFunction(
    (name) => !window.app.vault.getFolderByPath(`Projects/${name}`),
    TRASH_PROJECT,
  );
  const trashed = await listFiles(`${TEST_VAULT_PATH}/.trash`);
  assert(trashed.some((path) => !before.has(path) && path.endsWith("/Trash task.md")));
  console.log("PASS scratch removal uses recoverable vault-local trash");
}

async function exists(page, path) {
  return page.evaluate((path) => !!window.app.vault.getAbstractFileByPath(path), path);
}
async function text(path) {
  return readFile(`${TEST_VAULT_PATH}/${path}`, "utf8");
}
async function editorLog(page) {
  return page.evaluate(async () => {
    const view = window.app.workspace.activeEditor;
    const value = view?.editor.getValue();
    if (!value) throw new Error("Expected active project log");
    return value;
  });
}
async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await listFiles(path)));
    else result.push(path);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
