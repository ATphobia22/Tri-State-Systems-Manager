import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'integrations/third-party-toolchain.json'), 'utf8'));
const checks = manifest.tools.map((tool) => {
  const packagePath = join(root, 'tsm-console', 'node_modules', ...tool.name.split('/'), 'package.json');
  return { name: tool.name, version: tool.version, installed: existsSync(packagePath), mode: tool.mode };
});
const ciTooling = checks.filter((item) => item.mode === 'ci-tooling');
if (process.env.TSM_REQUIRE_EXTERNAL_TOOLING === 'true' && ciTooling.some((item) => !item.installed)) throw new Error(`required external tooling missing: ${ciTooling.filter((item) => !item.installed).map((item) => item.name).join(', ')}`);
console.log(JSON.stringify({ ok: true, checks, required: process.env.TSM_REQUIRE_EXTERNAL_TOOLING === 'true' }));
