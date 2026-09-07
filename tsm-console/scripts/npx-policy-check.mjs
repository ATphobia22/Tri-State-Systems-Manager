import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const WORKFLOW_ROOT = path.join(REPO_ROOT, '.github', 'workflows');
const REMOTE_NPX = /\bnpx\s+(?:--yes\s+)?(?:@[^\s]+\/)?[A-Za-z0-9._-]+(?:@[^\s]+)?/g;
const PINNED = /@[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?(?:\s|$)/;

function workflowFiles() {
  if (!fs.existsSync(WORKFLOW_ROOT)) return [];
  return fs.readdirSync(WORKFLOW_ROOT).filter((name) => /\.(yml|yaml)$/.test(name)).map((name) => path.join(WORKFLOW_ROOT, name));
}

export function findUnsafeNpx(text) {
  const findings = [];
  for (const match of text.matchAll(REMOTE_NPX)) {
    const line = text.slice(0, match.index).split('\n').length;
    if (!PINNED.test(match[0])) findings.push({ line, command: match[0].trim() });
  }
  return findings;
}

export function validateNpxPolicy(files = workflowFiles()) {
  const findings = files.flatMap((file) => findUnsafeNpx(fs.readFileSync(file, 'utf8')).map((finding) => ({ ...finding, file: path.relative(REPO_ROOT, file) })));
  if (findings.length) throw new Error(`unsafe remote npx execution found: ${JSON.stringify(findings)}`);
  return { ok: true, checkedFiles: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(validateNpxPolicy(), null, 2));
