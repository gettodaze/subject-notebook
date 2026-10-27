import { copyFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const OUTPUT_DIRECTORY = "dist/subject-notebook";
const ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

async function main() {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  for (const filename of ARTIFACTS)
    await copyFile(filename, `${OUTPUT_DIRECTORY}/${filename}`);
  console.log(`Plugin files ready in ${OUTPUT_DIRECTORY}/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
