#!/usr/bin/env node
/**
 * TSM parser gate.
 *
 * Detects malformed JSON and invalid JavaScript modules before Vite/ingestion
 * orchestration obscures the root cause. TypeScript syntax/type safety is
 * validated separately by `tsc --noEmit`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.git')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}

walk(root);

for (const file of files) {
  const rel = path.relative(root, file);
  const ext = path.extname(file).toLowerCase();

  if (ext === '.json') {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      failures.push(`${rel}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (ext === '.mjs' || ext === '.js') {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) {
      failures.push(`${rel}: JavaScript syntax check failed:\n${(result.stderr || result.stdout || '').trim()}`);
    }
  }

  if (ext === '.ts' || ext === '.tsx') {
    const source = fs.readFileSync(file, 'utf8');
    const result = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
    });
    const syntaxErrors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
    if (syntaxErrors.length) {
      failures.push(`${rel}: TypeScript lexical/parse check failed:\n${ts.formatDiagnosticsWithColorAndContext(syntaxErrors, { getCurrentDirectory: () => root, getCanonicalFileName: (name) => name, getNewLine: () => '\\n' }).trim()}`);
    }
  }
}

const [major] = process.versions.node.split('.').map(Number);
if (!Number.isFinite(major) || major < 22) {
  failures.push(`Node.js ${process.versions.node} is unsupported; TSM requires Node.js >= 22.`);
}

if (failures.length) {
  console.error('[tsm] FAIL-CLOSED parse gate');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[tsm] parse gate passed: Node ${process.versions.node}; ${files.length} files scanned.`);
