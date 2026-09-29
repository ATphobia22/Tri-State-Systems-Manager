#!/usr/bin/env node
/**
 * stage-desktop.mjs — copy packaged inputs under desktop/stage/ so
 * electron-builder `files` patterns stay inside the project directory
 * (no `../` in asar file mappings).
 *
 * Run after the SPA build: npm run build --prefix tsm-console
 */
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DESKTOP = join(here, '..');
const CONSOLE = join(DESKTOP, '..');
const STAGE = join(DESKTOP, 'stage');

const distSrc = join(CONSOLE, 'dist');
if (!existsSync(join(distSrc, 'index.html'))) {
  console.error(`SPA build missing: ${distSrc}/index.html — run "npm run build --prefix tsm-console" first.`);
  process.exit(2);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
cpSync(distSrc, join(STAGE, 'dist'), { recursive: true });
console.log(JSON.stringify({ staged: join(STAGE, 'dist') }));
