#!/usr/bin/env node
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../../tsm-console/dist/', import.meta.url);
const artifactDir = new URL('../../tsm-console/artifacts/', import.meta.url);
const budget = {
  maxJsChunkBytes: Number(process.env.TSM_MAX_JS_CHUNK_BYTES || 1_150_000),
  maxTotalJsBytes: Number(process.env.TSM_MAX_TOTAL_JS_BYTES || 2_500_000),
  maxTotalCssBytes: Number(process.env.TSM_MAX_TOTAL_CSS_BYTES || 500_000),
};
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}
const files = await walk(root.pathname);
const assets = [];
for (const file of files) {
  const info = await stat(file);
  if (!/\.(js|css)$/i.test(file)) continue;
  assets.push({ file: relative(root.pathname, file).replaceAll('\\', '/'), bytes: info.size });
}
const js = assets.filter((entry) => entry.file.endsWith('.js'));
const css = assets.filter((entry) => entry.file.endsWith('.css'));
const measured = {
  generated_at: new Date().toISOString(),
  source: 'clean production build output',
  budgets: budget,
  javascript: { total_bytes: js.reduce((sum, entry) => sum + entry.bytes, 0), max_chunk_bytes: Math.max(0, ...js.map((entry) => entry.bytes)), files: js },
  css: { total_bytes: css.reduce((sum, entry) => sum + entry.bytes, 0), files: css },
};
const violations = [
  ...js.filter((entry) => entry.bytes > budget.maxJsChunkBytes).map((entry) => `JS chunk ${entry.file} exceeds ${budget.maxJsChunkBytes} bytes`),
  ...(measured.javascript.total_bytes > budget.maxTotalJsBytes ? [`total JS exceeds ${budget.maxTotalJsBytes} bytes`] : []),
  ...(measured.css.total_bytes > budget.maxTotalCssBytes ? [`total CSS exceeds ${budget.maxTotalCssBytes} bytes`] : []),
];
await mkdir(artifactDir, { recursive: true });
await writeFile(new URL('performance-budget.json', artifactDir), JSON.stringify({ measured, violations }, null, 2) + '\n');
console.log(JSON.stringify({ measured, violations }, null, 2));
if (violations.length) process.exit(1);
