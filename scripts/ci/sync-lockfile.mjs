#!/usr/bin/env node
/**
 * TSM lockfile synchronization gate + repair helper.
 * Fail-closed: package.json and package-lock.json must agree; peers must be satisfiable.
 * Usage: node scripts/ci/sync-lockfile.mjs [--json] [--fix]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const consoleDir = join(repoRoot, "tsm-console");
const pkgPath = join(consoleDir, "package.json");
const lockPath = join(consoleDir, "package-lock.json");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const wantFix = args.has("--fix");

function parseVersion(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function satisfiesOne(version, alt) {
  const ver = parseVersion(version);
  if (!ver || !alt) return true;
  const tokens = alt.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (t.startsWith(">=")) {
      const lo = parseVersion(t.slice(2));
      if (lo && cmp(ver, lo) < 0) return false;
    } else if (t.startsWith(">") && !t.startsWith(">=")) {
      const lo = parseVersion(t.slice(1));
      if (lo && cmp(ver, lo) <= 0) return false;
    } else if (t.startsWith("<=")) {
      const hi = parseVersion(t.slice(2));
      if (hi && cmp(ver, hi) > 0) return false;
    } else if (t.startsWith("<")) {
      const hi = parseVersion(t.slice(1));
      if (hi && cmp(ver, hi) >= 0) return false;
    } else if (t.startsWith("^")) {
      const base = parseVersion(t.slice(1));
      if (base) {
        if (cmp(ver, base) < 0) return false;
        const upper = base[0] === 0 ? [0, base[1] + 1, 0] : [base[0] + 1, 0, 0];
        if (cmp(ver, upper) >= 0) return false;
      }
    } else if (t.startsWith("~")) {
      const base = parseVersion(t.slice(1));
      if (base) {
        if (cmp(ver, base) < 0) return false;
        const upper = [base[0], base[1] + 1, 0];
        if (cmp(ver, upper) >= 0) return false;
      }
    }
  }
  return true;
}

function satisfies(version, spec) {
  if (!version || !spec) return true;
  return spec.split("||").map((s) => s.trim()).some((alt) => satisfiesOne(version, alt));
}

function load() {
  if (!existsSync(pkgPath) || !existsSync(lockPath)) {
    return { ok: false, errors: ["Missing package.json or package-lock.json under tsm-console/"] };
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  const packages = lock.packages || {};
  const root = packages[""] || {};
  const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const errors = [];
  const peerConflicts = [];
  const pinDrift = [];

  for (const [name, range] of Object.entries(declared)) {
    const lockedEntry = packages[`node_modules/${name}`];
    const rootDep =
      (root.dependencies && root.dependencies[name]) ||
      (root.devDependencies && root.devDependencies[name]);
    if (!lockedEntry) {
      errors.push(`MISSING_IN_LOCK: ${name} declared as ${range}`);
      continue;
    }
    if (!range.startsWith("^") && !range.startsWith("~") && rootDep && rootDep !== range) {
      pinDrift.push({ name, packageJson: range, lockRoot: rootDep, lockedVersion: lockedEntry.version });
      errors.push(
        `PIN_DRIFT: ${name} package.json="${range}" but lock root dependency="${rootDep}" (resolved ${lockedEntry.version})`,
      );
    }
  }

  for (const [key, entry] of Object.entries(packages)) {
    if (!key.startsWith("node_modules/")) continue;
    const name = key.slice("node_modules/".length);
    const peers = entry.peerDependencies || {};
    for (const [peer, spec] of Object.entries(peers)) {
      const peerEntry = packages[`node_modules/${peer}`];
      if (!peerEntry?.version) continue;
      if (!satisfies(peerEntry.version, spec)) {
        peerConflicts.push({
          package: name,
          packageVersion: entry.version,
          peer,
          peerSpec: spec,
          installed: peerEntry.version,
        });
        errors.push(
          `PEER_CONFLICT: ${name}@${entry.version} requires ${peer} "${spec}" but lock has ${peerEntry.version}`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    packageManager: pkg.packageManager || null,
    engines: pkg.engines || null,
    pinDrift,
    peerConflicts,
    errors,
    critical: {
      react: packages["node_modules/react"]?.version,
      fiber: packages["node_modules/@react-three/fiber"]?.version,
      fiberPeerReact: packages["node_modules/@react-three/fiber"]?.peerDependencies?.react,
      fiberPkg: declared["@react-three/fiber"],
    },
  };
}

const report = load();
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("TSM lockfile sync gate");
  console.log("  critical:", JSON.stringify(report.critical));
  if (report.ok) {
    console.log("  status: OK — package.json and package-lock.json aligned; peers satisfiable");
  } else {
    console.log("  status: FAIL");
    for (const e of report.errors) console.log("   -", e);
  }
  if (wantFix && !report.ok) {
    console.log("\nRepair (run on a machine with network):");
    console.log("  cd tsm-console");
    console.log("  npm install -g npm@10.9.2");
    console.log("  npm install --no-audit --no-fund --registry=https://registry.npmjs.org");
    console.log("  npm ci --no-audit --no-fund");
    console.log("  git add package.json package-lock.json && git commit && git push");
  }
}
process.exit(report.ok ? 0 : 1);
