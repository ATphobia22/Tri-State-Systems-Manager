import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const OUT_DIR = process.env.TSM_ARTIFACT_DIR || path.join(process.cwd(), 'artifacts');
const SBOM_PATH = path.join(OUT_DIR, 'tsm-console-sbom.json');
const MANIFEST_PATH = path.join(OUT_DIR, 'tsm-console-provenance.json');

fs.mkdirSync(OUT_DIR, { recursive: true });
const npmCommand = process.env.npm_execpath || 'npm';
const sbom = execFileSync(npmCommand, ['sbom', '--package-lock-only', '--sbom-format', 'cyclonedx', '--omit', 'optional'], { encoding: 'utf8' });
fs.writeFileSync(SBOM_PATH, sbom);
const sha256 = createHash('sha256').update(sbom).digest('hex');
const manifest = {
  schema: 'tsm.software-provenance/v1',
  git_sha: process.env.GITHUB_SHA || 'local',
  node: process.version,
  npm: process.env.npm_config_user_agent || 'unknown',
  package_lock_sha256: createHash('sha256').update(fs.readFileSync(path.join(process.cwd(), 'package-lock.json'))).digest('hex'),
  sbom_sha256: sha256,
  sbom_format: 'CycloneDX',
  generated_at: new Date().toISOString(),
};
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ sbom: SBOM_PATH, manifest: MANIFEST_PATH, ...manifest }, null, 2));
