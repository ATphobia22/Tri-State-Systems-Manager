import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'install-script-allowlist.json');
const EXPECTED_NPM = '10.9.2';

function fail(message) { throw new Error(`dependency integrity failure: ${message}`); }
function packageNameFromLockPath(lockPath) {
  const marker = '/node_modules/';
  const index = lockPath.lastIndexOf(marker);
  if (index < 0) return null;
  const tail = lockPath.slice(index + marker.length).split('/');
  if (tail[0]?.startsWith('@')) return tail.length >= 2 ? `${tail[0]}/${tail[1]}` : null;
  return tail[0] || null;
}

export function validateDependencyIntegrity({ packageJson, lockJson, allowlist = { root: true, dependencies: [] }, nodeVersion = process.version, npmVersion = EXPECTED_NPM } = {}) {
  if (!packageJson || !lockJson) fail('package.json and package-lock.json are required');
  if (packageJson.packageManager !== `npm@${EXPECTED_NPM}`) fail(`packageManager must be npm@${EXPECTED_NPM}`);
  if (!lockJson.lockfileVersion || lockJson.lockfileVersion < 2) fail('unsupported or missing lockfileVersion');
  if (!lockJson.packages?.['']) fail('root lockfile package metadata is missing');
  if (npmVersion !== EXPECTED_NPM) fail(`npm ${EXPECTED_NPM} required, found ${npmVersion}`);
  const major = Number(String(nodeVersion).replace(/^v/, '').split('.')[0]);
  if (!Number.isInteger(major) || major < 22) fail(`Node 22+ required, found ${nodeVersion}`);
  const root = lockJson.packages[''];
  const declared = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  for (const [name, version] of Object.entries(declared)) {
    if (!root.dependencies?.[name] && !root.devDependencies?.[name] && !lockJson.packages[`node_modules/${name}`]) fail(`dependency missing from lockfile: ${name}`);
    if (version === '') fail(`empty dependency range: ${name}`);
  }
  const allowed = new Set(allowlist.dependencies || []);
  const installScriptPackages = [];
  for (const [lockPath, metadata] of Object.entries(lockJson.packages)) {
    if (!metadata?.hasInstallScript || lockPath === '') continue;
    const name = packageNameFromLockPath(lockPath);
    if (name && !allowed.has(name)) installScriptPackages.push(name);
  }
  if (installScriptPackages.length) fail(`unreviewed install scripts: ${[...new Set(installScriptPackages)].sort().join(', ')}`);
  if (root.hasInstallScript && allowlist.root !== true) fail('root install script is not approved');
  return { ok: true, npm: npmVersion, node: nodeVersion, lockfileVersion: lockJson.lockfileVersion, reviewedInstallScripts: [...allowed].sort() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const lockJson = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  console.log(JSON.stringify(validateDependencyIntegrity({ packageJson, lockJson, allowlist, nodeVersion: process.version, npmVersion: process.env.NPM_VERSION || EXPECTED_NPM }), null, 2));
}
