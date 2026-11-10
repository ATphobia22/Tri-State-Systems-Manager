import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../../.github/workflows/tsm-native.yml", import.meta.url), "utf8");
const builder = readFileSync(new URL("./Build-TSMNativeWindows.ps1", import.meta.url), "utf8");
const windowsJob = workflow.split(/^  package-windows:\s*$/m)[1]?.split(/^  package-macos:\s*$/m)[0];

test("authorized Shipping queue is isolated from routine push cancellation", () => {
  assert.match(workflow, /group:.*github\.run_id.*'ci'/);
  assert.match(workflow, /cancel-in-progress:.*!\(\(/);
  assert.match(workflow, /\[TSM-UE-PACKAGE\]/);
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.package_windows/);
});
test("cooked UE Shipping executable must be signed BEFORE installer compilation", () => {
  assert.ok(windowsJob);
  assert.match(windowsJob, /TSM_WINDOWS_SIGNING_CERT_SHA1: \$\{\{ secrets\.TSM_WINDOWS_SIGNING_CERT_SHA1 \}\}/);
  assert.match(windowsJob, /TSM_WINDOWS_TIMESTAMP_URL: \$\{\{ vars\.TSM_WINDOWS_TIMESTAMP_URL \}\}/);
  assert.match(builder, /Get-ChildItem .* -Filter TSMNative\.exe/);
  assert.match(builder, /signtool\.exe/);
  assert.match(builder, /sign \/sha1 .*\/fd SHA256 \/tr .*\/td SHA256/);
  assert.match(builder, /verify \/pa \/all/);
  assert.match(builder, /Get-AuthenticodeSignature/);
  assert.ok(builder.indexOf("Get-AuthenticodeSignature") < builder.indexOf("ISCC.exe"), "sign extracted binary before wrapping it in installer");
});
