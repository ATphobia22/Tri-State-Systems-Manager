#!/usr/bin/env node
/**
 * TSM parser gate.
 *
 * Detects malformed JSON, invalid JavaScript modules, and missing runtime
 * requirements before Vite/ingestion orchestration obscures the root cause.
 * TypeScript syntax is validated separately by `tsc --noEmit`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.git')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else yieldFile(full);
  }
}

const files = [];
function yieldFile(file) { files.push(file); }
walk(root);

for (const file of files) {
  const rel = path.relative(root, file);
  const ext = path.extname(file).toLowerCase();

  if (ext === '.json') {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      failures.push(`${rel}: invalid JSON: ${error.message}`);
    }
  }

  if (ext === '.mjs' || ext === '.js') {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      failures.push(`${rel}: JavaScript syntax check failed:\n${(result.stderr || result.stdout).trim()}`);
    }
  }
}

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(major) || major < 20) {
  failures.push(`Node.js ${process.versions.node} is unsupported; TSM requires Node.js >= 20.`);
}

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED parse gate');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[tsm] parse gate passed: Node ${process.versions.node}; ${files.length} files scanned.`);
