import { test } from "node:test";
import assert from "node:assert/strict";
import { FileQueue, SwitchQueue } from "../src/core/serial";

test("rapid operations serialize and rejected operations do not poison a file queue", async (): Promise<void> => {
  const queue = new FileQueue();
  let content = "";
  await Promise.all(
    Array.from({ length: 20 }, () =>
      queue.run("log", async () => {
        await Promise.resolve();
        if (!content.includes("heading")) content += "heading";
      }),
    ),
  );
  assert.equal(content, "heading");
  await assert.rejects(
    queue.run("log", async (): Promise<void> => {
      throw new Error("write failed");
    }),
  );
  await queue.run("log", async () => {
    content += " next";
  });
  assert.equal(content, "heading next");
});

test("only the newest queued switch commits and unload invalidates active work", async (): Promise<void> => {
  const queue = new SwitchQueue();
  const committed: number[] = [];
  await Promise.all(
    [1, 2, 3].map((value) =>
      queue.run(async (current) => {
        await Promise.resolve();
        if (current()) committed.push(value);
      }),
    ),
  );
  assert.deepEqual(committed, [3]);
  await queue.run(async (current) => {
    queue.cancel();
    assert.equal(current(), false);
  });
});
