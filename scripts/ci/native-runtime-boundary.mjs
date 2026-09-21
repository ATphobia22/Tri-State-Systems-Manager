import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "tsm-native/TSMNative.uproject",
  "tsm-native/Source/TSMNative/TSMNative.Build.cs",
  "tsm-native/Source/TSMNative/TSMNative.cpp",
  "tsm-native/config/sovereign-runtime-policy.json"
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`Missing native runtime file: ${relative}`);
  }
}

const files = [
  ...required,
  "tsm-native/Source/TSMNative/ArchimedesRuntime.cpp",
  "tsm-native/Source/TSMNative/TSMEmbeddedStore.cpp",
  "tsm-native/Source/TSMNative/TSMGeodeticViewport.cpp"
];

const text = files
  .map((relative) => fs.readFileSync(path.join(root, relative), "utf8"))
  .join("\n")
  .toLowerCase();

for (const forbidden of [
  "http://localhost",
  "https://localhost",
  "npm run dev",
  "npm start",
  "express()",
  "webbrowserwidget"
]) {
  if (text.includes(forbidden)) {
    throw new Error(`Forbidden native-runtime dependency/token detected: ${forbidden}`);
  }
}

const policy = JSON.parse(
  fs.readFileSync(
    path.join(root, "tsm-native/config/sovereign-runtime-policy.json"),
    "utf8"
  )
);

if (
  policy.runtime.webBrowser !== false ||
  policy.runtime.nodeJs !== false ||
  policy.runtime.localhostServer !== false ||
  policy.runtime.outboundNetwork !== false
) {
  throw new Error("Sovereign runtime policy must disable browser, Node.js, localhost, and outbound network.");
}

console.log("Native sovereign runtime boundary gate passed.");
