import { build } from "esbuild";
import { readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

async function main() {
  const files = (await readdir("test")).filter((name) => name.endsWith(".test.ts"));
  await mkdir("dist/test", { recursive: true });
  await build({
    stdin: {
      contents: files.map((name) => `import "./test/${name}";`).join("\n"),
      resolveDir: process.cwd(),
    },
    outfile: "dist/test.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    alias: { obsidian: resolve("test/obsidian.ts") },
  });
  const result = spawnSync(process.execPath, ["dist/test.cjs"], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
