#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'dist'];
const ignored = new Set(['node_modules', '.git', 'coverage']);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /\b(?:ghp|github_pat|github)_[-A-Za-z0-9_]{20,}\b/i,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/i,
  /\bclient_secret\b/i,
  /\b(?:AWS_SECRET_ACCESS_KEY|GOOGLE_APPLICATION_CREDENTIALS|TSM_EVIDENCE_SIGNING_KEY_PEM)\b/i,
];
const failures = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const stat = fs.statSync(full);
      if (stat.size > 2_000_000) continue;
      let text;
      try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
      for (const pattern of patterns) if (pattern.test(text)) failures.push(full + ': matched ' + pattern);
    }
  }
}
roots.forEach(walk);
if (failures.length) {
  console.error('[tsm] FAIL-CLOSED browser secret/credential gate');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('[tsm] browser secret/credential gate passed');
