import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'integrations/third-party-toolchain.json'), 'utf8'));
if (manifest.installPolicy !== 'ci-network-only') throw new Error('external tooling install policy changed unexpectedly');
if (process.env.TSM_INSTALL_EXTERNAL_TOOLING !== 'true') {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'TSM_INSTALL_EXTERNAL_TOOLING is not true' }));
  process.exit(0);
}
const tools = manifest.tools.filter((item) => item.mode === 'ci-tooling');
const specs = tools.map((tool) => `${tool.name}@${tool.version}`);
const result = spawnSync('npm', ['install', '--no-save', '--package-lock=false', '--ignore-scripts', ...specs], {
  cwd: join(root, 'tsm-console'),
  stdio: 'inherit',
  env: process.env,
});
if (result.status !== 0) throw new Error(`failed to install external tooling: ${specs.join(', ')}`);
console.log(JSON.stringify({ ok: true, installed: specs }));
