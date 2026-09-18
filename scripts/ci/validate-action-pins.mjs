import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowDir = join(process.cwd(), '..', '.github', 'workflows');
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
console.log('GitHub Action pin policy passed.');
