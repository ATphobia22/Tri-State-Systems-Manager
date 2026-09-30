import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const config = JSON.parse(await readFile(path, "utf8"));

config.bundle ??= {};

const publicKey = process.env.TSM_UPDATER_PUBLIC_KEY?.trim();
if (publicKey) {
  config.bundle.createUpdaterArtifacts = true;
  config.plugins ??= {};
  config.plugins.updater ??= {};
  config.plugins.updater.pubkey = publicKey;
} else {
  // No signing secrets configured: build an unsigned release without
  // updater artifacts rather than failing the whole release pipeline.
  config.bundle.createUpdaterArtifacts = false;
  console.warn(
    "WARNING: TSM_UPDATER_PUBLIC_KEY is not set; building UNSIGNED desktop release without updater artifacts."
  );
}

if (process.env.TSM_WINDOWS_CERTIFICATE_THUMBPRINT?.trim()) {
  config.bundle.windows ??= {};
  config.bundle.windows.certificateThumbprint =
    process.env.TSM_WINDOWS_CERTIFICATE_THUMBPRINT.trim();
  config.bundle.windows.digestAlgorithm = "sha256";
  config.bundle.windows.timestampUrl =
    process.env.TSM_WINDOWS_TIMESTAMP_URL?.trim() ||
    "https://timestamp.digicert.com";
}

await writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf8");
console.log("Configured release signing and updater public key.");
