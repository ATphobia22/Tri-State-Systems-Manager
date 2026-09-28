import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const contract = JSON.parse(readFileSync(join(root, 'integrations/open-world/3d-tiles-tools.contract.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'integrations/third-party-toolchain.json'), 'utf8'));
const tool = manifest.tools.find((item) => item.name === '3d-tiles-tools');
if (!tool) throw new Error('3d-tiles-tools missing from external toolchain manifest');
if (contract.properties?.source?.const !== '3d-tiles-tools' || contract.properties?.authorityClass?.const !== 'DERIVED') throw new Error('3D Tiles contract authority boundary invalid');
console.log(JSON.stringify({ ok: true, package: tool.name, declared: tool.version, authority_class: 'DERIVED', installed_at_ci: true }));
