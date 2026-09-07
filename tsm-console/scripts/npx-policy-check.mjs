import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const WORKFLOW_ROOT = path.join(REPO_ROOT, '.github', 'workflows');
const NPX_COMMAND = /\bnpx\s+(?:--yes\s+)?(.+?)(?=\s*(?:$|&&|\|\||;))/;
const PINNED = /@[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?(?:\s|$)/;

function workflowFiles() {
  if (!fs.existsSync(WORKFLOW_ROOT)) return [];
  return fs.readdirSync(WORKFLOW_ROOT).filter((name) => /\.(yml|yaml)$/.test(name)).map((name) => path.join(WORKFLOW_ROOT, name));
}

export function findUnsafeNpx(text) {
  const findings = [];
  for (const [index, lineText] of text.split('\n').entries()) {
    if (/^\s*-\s*name:/.test(lineText)) continue;
    if (!/^\s*(?:run:\s*|npx\s+)/.test(lineText) || !/\bnpx\s+/.test(lineText)) continue;
    const match = lineText.match(NPX_COMMAND);
    if (!match) continue;
    const command = match[1].trim();
    if (command.startsWith('--no-install ')) continue;
    if (PINNED.test(command)) continue;
    findings.push({ line: index + 1, command: `npx ${command}` });
  }
  return findings;
}

export function validateNpxPolicy(files = workflowFiles()) {
  const findings = files.flatMap((file) => findUnsafeNpx(fs.readFileSync(file, 'utf8')).map((finding) => ({ ...finding, file: path.relative(REPO_ROOT, file) })));
  if (findings.length) throw new Error(`unsafe remote npx execution found: ${JSON.stringify(findings)}`);
  return { ok: true, checkedFiles: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(validateNpxPolicy(), null, 2));
