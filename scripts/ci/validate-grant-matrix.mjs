#!/usr/bin/env node
/**
 * Grant matrix integrity gate (Posey / 47620).
 * Validates presence of deadline calendar, flood-water map, critical checklists,
 * and matrix workbook (XLSX) or CSV export. Does not file grants.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const grantsDir = join(repoRoot, "docs", "grants");

const required = [
  "DEADLINE-CALENDAR-30-60-90-2026-10-08.md",
  "FLOOD-WATER-PROGRAMS-TSM-EVIDENCE-MAP-2026-10-08.md",
  "CHECKLISTS-JAG-LEPP-EMPG-HMEP-2026-10-08.md",
];
const matrixWorkbook = "47620-Grant-Master-Matrix-2026-10-08.xlsx";
const matrixCsv = "47620-Grant-Master-Matrix-2026-10-08.csv";

const errors = [];
const info = [];

if (!existsSync(grantsDir)) {
  errors.push(`missing grants directory: ${grantsDir}`);
} else {
  for (const name of required) {
    const p = join(grantsDir, name);
    if (!existsSync(p)) {
      errors.push(`missing required grant artifact: docs/grants/${name}`);
      continue;
    }
    const st = statSync(p);
    if (st.size < 100) {
      errors.push(`grant artifact too small: docs/grants/${name} (${st.size} bytes)`);
    } else {
      info.push({ file: name, bytes: st.size });
    }
  }
}

const xlsxPath = join(grantsDir, matrixWorkbook);
const csvPath = join(grantsDir, matrixCsv);
if (existsSync(xlsxPath) && statSync(xlsxPath).size >= 100) {
  info.push({ file: matrixWorkbook, bytes: statSync(xlsxPath).size });
} else if (existsSync(csvPath) && statSync(csvPath).size >= 100) {
  info.push({ file: matrixCsv, bytes: statSync(csvPath).size });
} else {
  errors.push(`missing matrix workbook or CSV: docs/grants/${matrixWorkbook} or ${matrixCsv}`);
}

const calendarPath = join(grantsDir, "DEADLINE-CALENDAR-30-60-90-2026-10-08.md");
if (existsSync(calendarPath)) {
  const text = readFileSync(calendarPath, "utf8");
  for (const needle of ["DOJ-JAG-2026", "IN-ICJI-LEPP-FY27", "IDHS-HMEP-FY27", "IDHS-EMPG-S-FY26"]) {
    if (!text.includes(needle)) {
      const aliases = {
        "DOJ-JAG-2026": "JAG",
        "IN-ICJI-LEPP-FY27": "LEPP",
        "IDHS-HMEP-FY27": "HMEP",
        "IDHS-EMPG-S-FY26": "EMPG",
      };
      if (!text.includes(aliases[needle])) {
        errors.push(`calendar missing critical program marker: ${needle}`);
      }
    }
  }
  if (!text.includes("No auto-submit") && !text.includes("does not submit") && !text.includes("does not auto-submit")) {
    errors.push("calendar must state TSM does not auto-submit applications");
  }
}

const floodPath = join(grantsDir, "FLOOD-WATER-PROGRAMS-TSM-EVIDENCE-MAP-2026-10-08.md");
if (existsSync(floodPath)) {
  const text = readFileSync(floodPath, "utf8");
  for (const needle of ["USACE-FPMS", "USACE-PAS", "FEMA-HMGP", "NFHL-FIRM-SSOT"]) {
    if (!text.includes(needle)) {
      errors.push(`flood/water map missing marker: ${needle}`);
    }
  }
}

const result = {
  ok: errors.length === 0,
  gate: "grant-matrix",
  grantsDir: existsSync(grantsDir) ? grantsDir : null,
  files: info,
  listing: existsSync(grantsDir)
    ? readdirSync(grantsDir).filter((n) => !n.startsWith("."))
    : [],
  errors,
};

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
