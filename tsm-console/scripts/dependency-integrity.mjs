import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');
const EXPECTED_NPM = '10.9.2';

function fail(message) { throw new Error(`dependency integrity failure: ${message}`); }

export function validateDependencyIntegrity({ packageJson, lockJson, nodeVersion = process.version, npmVersion = EXPECTED_NPM } = {}) {
  if (!packageJson || !lockJson) fail('package.json and package-lock.json are required');
  if (packageJson.packageManager !== `npm@${EXPECTED_NPM}`) fail(`packageManager must be npm@${EXPECTED_NPM}`);
  if (!lockJson.lockfileVersion || lockJson.lockfileVersion < 2) fail('unsupported or missing lockfileVersion');
  if (!lockJson.packages?.['']) fail('root lockfile package metadata is missing');
  if (npmVersion !== EXPECTED_NPM) fail(`npm ${EXPECTED_NPM} required, found ${npmVersion}`);
  const major = Number(String(nodeVersion).replace(/^v/, '').split('.')[0]);
  if (!Number.isInteger(major) || major < 22) fail(`Node 22+ required, found ${nodeVersion}`);
  const root = lockJson.packages[''];
  for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
    if (!root.dependencies?.[name] && !lockJson.packages[`node_modules/${name}`]) fail(`dependency missing from lockfile: ${name}`);
    if (version === '') fail(`empty dependency range: ${name}`);
  }
  return { ok: true, npm: npmVersion, node: nodeVersion, lockfileVersion: lockJson.lockfileVersion };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const lockJson = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  console.log(JSON.stringify(validateDependencyIntegrity({ packageJson, lockJson, nodeVersion: process.version, npmVersion: process.env.NPM_VERSION || EXPECTED_NPM }), null, 2));
}
