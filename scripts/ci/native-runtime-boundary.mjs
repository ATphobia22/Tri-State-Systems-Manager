import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  path.join(root, "tsm-native", "TSMNative.uproject"),
  path.join(root, "tsm-native", "Source", "TSMNative", "TSMNative.Build.cs"),
  path.join(root, "tsm-native", "Source", "TSMNative", "TSMNative.cpp")
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    throw new Error("Missing native runtime file: " + file);
  }
}

const runtimeText = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const forbidden = [
  "http://localhost",
  "https://localhost",
  "WebBrowser",
  "WebBrowserWidget",
  "node server",
  "npm run dev",
  "npm start"
];

for (const token of forbidden) {
  if (runtimeText.toLowerCase().includes(token.toLowerCase())) {
    throw new Error("Forbidden native-runtime dependency/token detected: " + token);
  }
}

if (!runtimeText.includes('"OpenXR"') || !runtimeText.includes('"SQLiteCore"')) {
  throw new Error("Native runtime must explicitly enable OpenXR and SQLiteCore.");
}

console.log("Native runtime boundary gate passed.");
