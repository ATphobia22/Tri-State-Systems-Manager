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

const FORBIDDEN_PUBLIC_IDENTIFIERS = [
  '13101 Bonebank Road',
  '13101 Bonebank',
  'BONEBANK_SITE',
  'BONEBANK_LOOKUP',
  'tsm-site-constants-13101-bonebank',
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
    for (const identifier of FORBIDDEN_PUBLIC_IDENTIFIERS) {
      if (content.includes(identifier)) {
        violations.push(`${file}: ${identifier}`);
      }
    }
  }

  assert.deepEqual(violations, [], `Private identifiers leaked into public source:\n${violations.join('\n')}`);
});
