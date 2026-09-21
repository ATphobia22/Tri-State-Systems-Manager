import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const PUBLIC_SOURCE_PATHS = [
  'backend',
  'data',
  'docs',
  'tsm-console',
  'scripts',
];

const PRIVATE_IDENTIFIER_PATTERNS = [
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Highway|Hwy)\b/i,
  /\b\d{2}-\d{2}-\d{2}-\d{3}-\d{3}\.\d{3}-\d{3}\b/,
  /\bprivate[-_ ]?(?:residence|parcel|site)[-_ ]?(?:anchor|identifier)\b/i,
  /\b\d{5}-(?:[a-z0-9]+)-(?:site|lookup)\b/i,
];

const listGitFiles = async () => {
  const { stdout } = await new Promise((resolve, reject) => {
    const child = spawn('git', ['ls-files', ...PUBLIC_SOURCE_PATHS], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)));
  });
  return stdout.split('\n').filter(Boolean);
};

test('public source tree contains no private residence anchor identifiers', async () => {
  const files = await listGitFiles();
  const violations = [];

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    for (const pattern of PRIVATE_IDENTIFIER_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(file + ': ' + pattern);
      }
    }
  }

  assert.deepEqual(violations, [], `Private identifiers leaked into public source:\n${violations.join('\n')}`);
});
