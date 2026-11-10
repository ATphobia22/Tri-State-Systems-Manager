import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/tsm-native.yml", import.meta.url), "utf8");
const windowsJob = workflow.split(/^  package-windows:\s*$/m)[1]?.split(/^  package-macos:\s*$/m)[0];
test("Windows UE Shipping packaging requires an explicit operator request", () => {
  assert.ok(windowsJob, "Windows UE job must be present");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(windowsJob, /github\.event_name == 'workflow_dispatch' && inputs\.package_windows/);
  assert.match(windowsJob, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(windowsJob, /contains\(github\.event\.head_commit\.message, '\[TSM-UE-PACKAGE\]'\)/);
  assert.match(windowsJob, /runs-on: \[self-hosted, windows, x64, ue5\]/);
  assert.match(windowsJob, /verify-ue-windows-shipping\.mjs/);
  assert.match(windowsJob, /TSM_WINDOWS_SIGNING_CERT_SHA1/);
});
