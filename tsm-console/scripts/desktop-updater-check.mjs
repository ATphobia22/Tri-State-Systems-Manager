import { readFile } from "node:fs/promises";

const configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

if (config.bundle?.createUpdaterArtifacts !== true) {
  throw new Error("TSM desktop updater artifacts must remain enabled.");
}

const targets = config.bundle?.targets ?? [];
for (const required of ["nsis", "msi", "dmg"]) {
  if (!targets.includes(required)) {
    throw new Error("Missing required desktop target: " + required);
  }
}

console.log("TSM desktop bundle configuration passed.");
