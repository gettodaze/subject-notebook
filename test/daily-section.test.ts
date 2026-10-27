import { test } from "node:test";
import assert from "node:assert/strict";
import { dailySuffix, hasDailyHeading, localDate } from "../src/logs/daily-section";

const TODAY = "2026-10-26";

test("daily section is idempotent and independent of modification time", (): void => {
  const original = "Edited today, without a heading.";
  const updated = original + dailySuffix(original, TODAY);
  assert.equal(updated, `${original}\n\n## ${TODAY}\n\n`);
  assert.equal(dailySuffix(updated, TODAY), "");
});

test("exact date heading, not a prefix or a different heading level", (): void => {
  for (const content of [`### ${TODAY}`, `## ${TODAY} extra`, "## 2026-10-25"]) {
    assert.equal(hasDailyHeading(content, TODAY), false);
  }
  assert.equal(hasDailyHeading(`## ${TODAY}\r\n`, TODAY), true);
});

test("ignore dates inside frontmatter, fences, and longer nested fences", (): void => {
  const examples = [
    `---\nexample: |\n## ${TODAY}\n---\n`,
    `\uFEFF---\n## ${TODAY}\n---\n`,
    `\`\`\`\`markdown\n\`\`\`\n## ${TODAY}\n\`\`\`\`\n`,
    `~~~markdown\n## ${TODAY}\n~~~\n`,
  ];
  for (const example of examples) assert.equal(hasDailyHeading(example, TODAY), false);
});

test("preserve content and newline style", (): void => {
  assert.equal(dailySuffix("", TODAY), `## ${TODAY}\n\n`);
  assert.equal(dailySuffix("Existing\r\n", TODAY), `\r\n## ${TODAY}\r\n\r\n`);
  assert.equal(dailySuffix("Existing\n\n", TODAY), `## ${TODAY}\n\n`);
});

test("local date follows local calendar fields across midnight", (): void => {
  assert.equal(localDate(new Date(2026, 9, 26, 23, 59)), TODAY);
  assert.equal(localDate(new Date(2026, 9, 27, 0, 1)), "2026-10-27");
});
