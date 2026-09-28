import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'integrations/third-party-toolchain.json'), 'utf8'));
if (manifest.installPolicy !== 'ci-network-only') throw new Error('external tooling install policy changed unexpectedly');
if (process.env.TSM_INSTALL_EXTERNAL_TOOLING !== 'true') {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'TSM_INSTALL_EXTERNAL_TOOLING is not true' }));
  process.exit(0);
}
for (const tool of manifest.tools.filter((item) => item.mode === 'ci-tooling')) {
  const result = spawnSync('npm', ['install', '--no-save', '--package-lock=false', '--ignore-scripts', `${tool.name}@${tool.version}`], { cwd: join(root, 'tsm-console'), stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`failed to install ${tool.name}@${tool.version}`);
}
console.log(JSON.stringify({ ok: true, installed: manifest.tools.filter((item) => item.mode === 'ci-tooling').map((item) => `${item.name}@${item.version}`) }));
