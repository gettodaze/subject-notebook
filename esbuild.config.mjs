import * as esbuild from "esbuild";
import { pathToFileURL } from "node:url";

const WATCH_FLAG = "--watch";

async function main() {
  const context = await esbuild.context({
    entryPoints: ["src/main.ts"],
    outfile: "main.js",
    bundle: true,
    external: ["obsidian"],
    format: "cjs",
    platform: "browser",
    target: "es2022",
    sourcemap: process.argv.includes(WATCH_FLAG) ? "inline" : false,
    logLevel: "info",
  });
  if (process.argv.includes(WATCH_FLAG)) await context.watch();
  else {
    await context.rebuild();
    await context.dispose();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
