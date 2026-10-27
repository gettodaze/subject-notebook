import { test } from "node:test";
import assert from "node:assert/strict";
import type { Editor, TFile as HostFile, Vault, Workspace } from "obsidian";
import { MarkdownView, TFile } from "./obsidian";
import { LogService } from "../src/logs/log-service";

interface LogFixture {
  readonly service: LogService;
  readonly file: HostFile;
  readonly live: () => string;
  readonly stored: () => string;
  readonly writes: () => number;
}

function logFixture(
  initial: string,
  open: boolean,
  liveContent: string = initial,
): LogFixture {
  let stored = initial;
  let live = liveContent;
  let writes = 0;
  const file = new TFile("Projects/PFAS/Log.md");
  const editor = {
    getValue: (): string => live,
    lastLine: (): number => live.split("\n").length - 1,
    getLine: (line: number): string => live.split("\n")[line] ?? "",
    replaceRange: (suffix: string): void => {
      live += suffix;
      writes += 1;
    },
  } as unknown as Editor;
  const view = Object.assign(new MarkdownView(), {
    editor,
    file,
    getMode: (): string => "source",
  });
  const workspace = {
    getActiveViewOfType: (): unknown => (open ? view : null),
    iterateAllLeaves: (callback: (leaf: { view: unknown }) => void): void => {
      if (open) {
        callback({ view });
        callback({ view });
      }
    },
  } as unknown as Workspace;
  const vault = {
    read: async (): Promise<string> => stored,
    process: async (
      _file: unknown,
      update: (value: string) => string,
    ): Promise<string> => {
      stored = update(stored);
      writes += 1;
      return stored;
    },
  } as unknown as Vault;
  const service = new LogService(
    vault,
    workspace,
    () => true,
    () => new Date(2026, 9, 26),
  );
  return {
    service,
    file: file as unknown as HostFile,
    live: () => live,
    stored: () => stored,
    writes: () => writes,
  };
}

async function openRepeatedly(fixture: LogFixture): Promise<void> {
  await Promise.all(
    Array.from({ length: 20 }, () => fixture.service.ensureToday(fixture.file)),
  );
}

test("two editable panes append once to live content without a background overwrite", async (): Promise<void> => {
  const fixture = logFixture("Unsaved work", true);
  await openRepeatedly(fixture);
  assert.equal(fixture.writes(), 1);
  assert.equal(fixture.stored(), "Unsaved work");
  assert.equal(fixture.live(), "Unsaved work\n\n## 2026-10-26\n\n");
});

test("background log updates once, existing heading causes no writes", async (): Promise<void> => {
  const fixture = logFixture("Existing work", false);
  await openRepeatedly(fixture);
  assert.equal(fixture.writes(), 1);
  assert.equal(fixture.stored(), "Existing work\n\n## 2026-10-26\n\n");
});

test("unload invalidates pending log operations", async (): Promise<void> => {
  const fixture = logFixture("Existing work", true);
  fixture.service.dispose();
  await openRepeatedly(fixture);
  assert.equal(fixture.writes(), 0);
});

test("a heading in an unsaved buffer takes precedence over stale disk content", async (): Promise<void> => {
  const fixture = logFixture(
    "Yesterday's saved content",
    true,
    "Unsaved work\n\n## 2026-10-26\n\n",
  );
  await openRepeatedly(fixture);
  assert.equal(fixture.writes(), 0);
  assert.equal(fixture.stored(), "Yesterday's saved content");
  assert.equal(fixture.live(), "Unsaved work\n\n## 2026-10-26\n\n");
});
