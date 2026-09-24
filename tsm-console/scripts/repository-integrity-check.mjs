#!/usr/bin/env node
/**
 * Lightweight, deterministic repository integrity checks for CI.
 * This intentionally validates contracts that can be checked without network
 * access or domain-specific credentials.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const failures = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(root, file)}: invalid or unreadable JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function validateLockfileProvenance(lock) {
  for (const [packagePath, metadata] of Object.entries(lock?.packages ?? {})) {
    if (typeof metadata?.resolved !== 'string') continue;
    try {
      const url = new URL(metadata.resolved);
      if (url.hostname !== 'registry.npmjs.org') {
        failures.push(`package-lock.json: non-public resolved package URL at ${packagePath}: ${metadata.resolved}`);
      }
    } catch {
      failures.push(`package-lock.json: invalid resolved package URL at ${packagePath}: ${metadata.resolved}`);
    }
  }
}

const pkg = readJson(packagePath);
const lock = readJson(lockPath);

if (pkg) {
  if (pkg.packageManager !== 'npm@10.9.2') {
    failures.push(`package.json: expected packageManager npm@10.9.2, found ${String(pkg.packageManager)}`);
  }
  if (pkg.engines?.node !== '>=22') {
    failures.push(`package.json: expected engines.node >=22, found ${String(pkg.engines?.node)}`);
  }
  for (const script of ['check:parse', 'check:type', 'build', 'test:all']) {
    if (typeof pkg.scripts?.[script] !== 'string') failures.push(`package.json: missing required script ${script}`);
  }
}

if (lock) {
  if (lock.lockfileVersion !== 3) {
    failures.push(`package-lock.json: expected lockfileVersion 3, found ${String(lock.lockfileVersion)}`);
  }
  validateLockfileProvenance(lock);
}

const workflowsRoot = path.resolve(root, '..', '.github', 'workflows');
if (fs.existsSync(workflowsRoot)) {
  for (const file of fs.readdirSync(workflowsRoot)) {
    if (!(file.endsWith('.yml') || file.endsWith('.yaml'))) continue;
    const content = fs.readFileSync(path.join(workflowsRoot, file), 'utf8');
    if (/npm\s+ci/.test(content) && !/registry\.npmjs\.org/.test(content)) {
      failures.push(`workflow ${file}: npm ci workflow does not explicitly reference registry.npmjs.org`);
    }
  }
}

if (failures.length) {
  console.error('[tsm] repository integrity gate failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[tsm] repository integrity gate passed');
