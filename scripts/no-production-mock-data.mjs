import fs from 'node:fs';
import path from 'node:path';

const PROHIBITED = [/\bmock\b/i, /\bfake\b/i, /\bsynthetic\b/i, /Math\.random\s*\(/, /\b(?:stage|gage_height|water_level)\s*[:=]\s*\d+(?:\.\d+)?\b/i];
const ALLOWED = /(^|\/)(tests?|__tests__|fixtures?|demos?)(\/|$)|SIMULATION_DEMO/i;
export function scanProductionDataPaths(root, { files } = {}) {
  const entries = files || collectFiles(root); const violations = [];
  for (const [relativePath, content] of entries) {
    if (ALLOWED.test(relativePath)) continue;
    for (const pattern of PROHIBITED) if (pattern.test(content)) { violations.push({ path: relativePath, rule: pattern.source }); break; }
  }
  return violations;
}
function collectFiles(root) {
  const output = new Map();
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      const absolute = path.join(directory, entry.name); const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
      if (entry.isDirectory()) walk(absolute); else if (/\.(mjs|js|ts|tsx|jsx|json|html)$/.test(entry.name)) output.set(relative, fs.readFileSync(absolute, 'utf8'));
    }
  }
  walk(root); return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const violations = scanProductionDataPaths(path.resolve(process.argv[2] || 'tsm-console'));
  if (violations.length) { console.error(JSON.stringify(violations, null, 2)); process.exitCode = 1; } else console.log('No production mock/synthetic markers detected.');
}
