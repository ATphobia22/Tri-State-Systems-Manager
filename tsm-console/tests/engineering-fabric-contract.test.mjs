import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const kernel = resolve(root, "integrations/engineering-fabric/engineering_kernel.py");

function run(args) {
  return JSON.parse(execFileSync("python3", [kernel, ...args], { cwd: root, encoding: "utf8" }));
}

test("rational peak flow is deterministic and source-input driven", () => {
  const first = run(["peak-flow", "--c", "0.65", "--intensity-in-per-hr", "4.2", "--area-acres", "10"]);
  const second = run(["peak-flow", "--c", "0.65", "--intensity-in-per-hr", "4.2", "--area-acres", "10"]);
  assert.deepEqual(first, second);
  assert.ok(first.discharge_m3_s > 0);
});

test("berm volume is deterministic", () => {
  const result = run(["berm-volume", "--height-m", "2", "--top-width-m", "4", "--side-slope-hv", "2", "--length-m", "100"]);
  assert.equal(result.volume_m3, 1600);
});

test("dependency lock has immutable high-value releases", () => {
  const lock = JSON.parse(readFileSync(resolve(root, "contracts/dependencies/tsm-open-source-lock-v1.json"), "utf8"));
  const usd = lock.sources.find((item) => item.name === "OpenUSD");
  const opencv = lock.sources.find((item) => item.name === "OpenCV");
  const blas = lock.sources.find((item) => item.name === "OpenBLAS");
  assert.equal(usd.revision, "v26.08");
  assert.equal(opencv.revision, "5.0.0");
  assert.equal(blas.revision, "v0.3.34");
});
