#!/usr/bin/env node
/** Soft postinstall — never fail npm install for agency clones */
import { existsSync } from 'node:fs';
const checks = [
  'package.json',
  'vite.config.ts',
  'index.html',
  'src/main.tsx',
];
let ok = true;
for (const f of checks) {
  if (!existsSync(f)) {
    console.warn('[tsm postinstall] missing', f);
    ok = false;
  }
}
if (ok) console.log('[tsm postinstall] core files present');
process.exit(0);
