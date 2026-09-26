#!/usr/bin/env node
/**
 * Fail-closed: every external GitHub Action must be pinned to a full 40-char SHA.
 * Resolves workflow dir from repo root whether invoked from tsm-console or repository root.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const candidates = [
  join(repoRoot, '.github', 'workflows'),
  join(process.cwd(), '.github', 'workflows'),
  join(process.cwd(), '..', '.github', 'workflows'),
];
const workflowDir = candidates.find((p) => existsSync(p));
if (!workflowDir) {
  console.error('ERROR: could not locate .github/workflows (repo root detection failed).');
  console.error('Tried:', candidates);
  process.exit(1);
}

const shaPinned = /^[0-9a-f]{40}$/i;
const violations = [];

for (const file of readdirSync(workflowDir).filter((name) => /\.(yml|yaml)$/.test(name))) {
  const path = join(workflowDir, file);
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
    if (!match) return;
    const ref = match[1];
    if (ref.startsWith('./') || ref.startsWith('docker://')) return;
    const at = ref.lastIndexOf('@');
    if (at < 1 || !shaPinned.test(ref.slice(at + 1))) {
      violations.push(`${file}:${index + 1}: ${ref}`);
    }
  });
}

if (violations.length) {
  console.error('ERROR: every external GitHub Action must be pinned to a full 40-character commit SHA.');
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, gate: 'action-pins', workflowDir, checked: readdirSync(workflowDir).filter((n) => /\.(yml|yaml)$/.test(n)).length }, null, 2));
