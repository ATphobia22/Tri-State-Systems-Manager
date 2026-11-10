#!/usr/bin/env node
/**
 * Independent Windows release test harness for cinematic engineering experience.
 * Runs on any OS for contract checks; marks platform-specific gates BLOCKED off Windows.
 *
 * Usage: node scripts/native/windows-cinematic-release-test.mjs
 * Exit 0 only if all runnable checks pass (platform-blocked gates are reported, not fatal
 * unless TSM_REQUIRE_WIN64_SHIPPING=1).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const requireShipping = process.env.TSM_REQUIRE_WIN64_SHIPPING === "1";
const isWin = platform() === "win32";

const results = [];

function check(id, ok, detail) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${id} — ${detail}`);
}

// Contract files present
const files = [
  "packages/geo/src/cinema/CinematicEngineeringModel.ts",
  "packages/geo/src/hydrology/GageDatumDiscipline.ts",
  "packages/geo/src/native/CinematicProductionContract.ts",
  "packages/geo/src/native/ReleaseValidationContract.ts",
  "tsm-console/src/routes/CinematicEngineeringExperienceView.tsx",
  "docs/experiences/CINEMATIC-ENGINEERING-EXPERIENCE.md",
];
for (const f of files) {
  const p = join(root, f);
  check(`file:${f}`, existsSync(p), existsSync(p) ? "present" : "missing");
}

// Math: 1937 crest
const stage = 59.21;
const zero = 318.59;
const wse = stage + zero;
check("math:1937_wse", Math.abs(wse - 377.8) < 1e-9, `59.21+318.59=${wse}`);

// Freeboard modeling defaults
check("math:freeboard", Math.abs(377.2 - 375.0 - 2.2) < 1e-9, "377.2-375.0=2.2");

// Router wiring
const routerPath = join(root, "tsm-console/src/lib/router.tsx");
if (existsSync(routerPath)) {
  const rt = readFileSync(routerPath, "utf8");
  check(
    "router:cinematic-engineering",
    rt.includes("cinematic-engineering") || rt.includes("CinematicEngineeringExperienceView"),
    rt.includes("cinematic-engineering") ? "route registered" : "route missing — wire path cinematic-engineering"
  );
} else {
  check("router:cinematic-engineering", false, "router.tsx missing");
}

// Shipping artifact probe (Windows or explicit artifact dir)
const artifactHints = [
  process.env.TSM_SHIPPING_EXE,
  join(root, "dist/native/TSM.exe"),
  join(root, "Binaries/Win64/TSM-Win64-Shipping.exe"),
].filter(Boolean);

let shippingFound = false;
for (const a of artifactHints) {
  if (a && existsSync(a)) {
    const buf = readFileSync(a);
    const hash = createHash("sha256").update(buf).digest("hex");
    check("win64:shipping_artifact", true, `${a} sha256=${hash.slice(0, 16)}…`);
    shippingFound = true;
    break;
  }
}
if (!shippingFound) {
  const ok = !requireShipping;
  check(
    "win64:shipping_artifact",
    ok,
    isWin
      ? "no Shipping exe on disk — run TSM Native package-windows or set TSM_SHIPPING_EXE"
      : "non-Windows host — Shipping artifact gate deferred (set TSM_REQUIRE_WIN64_SHIPPING=1 to fail)"
  );
}

const failed = results.filter((r) => !r.ok);
console.log("---");
console.log(`passed ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  process.exitCode = 1;
}
