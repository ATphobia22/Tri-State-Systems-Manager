import { readFile } from "node:fs/promises";

const configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

const targets = config.bundle?.targets ?? [];
for (const required of ["nsis", "msi", "dmg"]) {
  if (!targets.includes(required)) {
    throw new Error("Missing required desktop target: " + required);
  }
}

const endpoints = config.plugins?.updater?.endpoints ?? [];
if (endpoints.length !== 1 || !String(endpoints[0]).startsWith("https://")) {
  throw new Error("TSM updater must use exactly one HTTPS endpoint.");
}

const publicKey = String(config.plugins?.updater?.pubkey ?? "").trim();
const releaseMode = process.env.TSM_DESKTOP_RELEASE === "1";

if (releaseMode) {
  if (config.bundle?.createUpdaterArtifacts !== true) {
    throw new Error("Release updater artifacts must be enabled.");
  }
  if (!publicKey) {
    throw new Error("Release updater public key is missing.");
  }
} else if (publicKey || config.bundle?.createUpdaterArtifacts === true) {
  throw new Error(
    "Development configuration must not contain the updater public key or enable signed release artifacts."
  );
}

console.log("TSM desktop updater configuration passed.");
