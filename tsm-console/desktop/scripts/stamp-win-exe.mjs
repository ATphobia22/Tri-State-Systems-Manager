/**
 * stamp-win-exe.mjs
 *
 * Stamps a Windows PE executable with the TSM icon and version metadata
 * using the pure-JavaScript `resedit` library. This replaces the rcedit/Wine
 * step that electron-builder normally performs, so Windows builds can be
 * produced on Linux without Wine.
 *
 * Used two ways:
 *  1. As an electron-builder `afterPack` hook (default export) — stamps the
 *     inner Electron exe in win-unpacked before the portable wrapper is made.
 *  2. As a CLI: `node scripts/stamp-win-exe.mjs <path-to.exe>` — stamps any
 *     PE file (e.g. the final portable stub exe).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NtExecutable, NtExecutableResource, Data, Resource } from 'resedit';

const LANG_EN_US = 1033;
const CODEPAGE_UNICODE = 1200;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

async function readPackageJson() {
  const raw = await readFile(path.join(root, 'package.json'), 'utf8');
  return JSON.parse(raw);
}

/**
 * Stamp icon + version metadata into a Windows PE file, in place.
 */
export async function stampExe(exePath) {
  const pkg = await readPackageJson();
  const [major = 0, minor = 0, patch = 0] = String(pkg.version)
    .split('.')
    .map((n) => Number(n) || 0);
  const productName = pkg.build?.productName ?? 'Tri-State Systems Manager';
  const companyName =
    typeof pkg.author === 'string' ? pkg.author : 'Tri-State Systems Manager contributors';
  const copyright = pkg.build?.copyright ?? '';
  const exeName = path.basename(exePath);

  const exe = NtExecutable.from(await readFile(exePath));
  const res = NtExecutableResource.from(exe);

  // Icon: replace every existing icon group with the TSM icon set.
  const iconFile = Data.IconFile.from(await readFile(path.join(root, 'assets', 'icon.ico')));
  const icons = iconFile.icons.map((item) => item.data);
  if (icons.length === 0) {
    throw new Error('icon.ico contains no icons');
  }
  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const groupIds = groups.length > 0 ? groups.map((g) => g.id) : [1];
  for (const id of groupIds) {
    Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, LANG_EN_US, icons);
  }

  // Version metadata.
  const viList = Resource.VersionInfo.fromEntries(res.entries);
  const vi = viList[0] ?? Resource.VersionInfo.createEmpty();
  vi.setFileVersion(major, minor, patch, 0, LANG_EN_US);
  vi.setProductVersion(major, minor, patch, 0, LANG_EN_US);
  vi.setStringValues(
    { lang: LANG_EN_US, codepage: CODEPAGE_UNICODE },
    {
      CompanyName: companyName,
      FileDescription: productName,
      FileVersion: `${major}.${minor}.${patch}.0`,
      InternalName: productName,
      LegalCopyright: copyright,
      OriginalFilename: exeName,
      ProductName: productName,
      ProductVersion: `${major}.${minor}.${patch}.0`,
    },
  );
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  await writeFile(exePath, Buffer.from(exe.generate()));
  console.log(`[stamp-win-exe] stamped icon + v${major}.${minor}.${patch} metadata into ${exeName}`);
}

// electron-builder afterPack hook: stamp the inner exe before wrappers are built.
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  await stampExe(path.join(context.appOutDir, exeName));
}

// CLI: node scripts/stamp-win-exe.mjs <path-to.exe> [...]
const invokedAsCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('usage: node scripts/stamp-win-exe.mjs <path-to.exe> [...]');
    process.exit(1);
  }
  for (const target of targets) {
    // eslint-disable-next-line no-await-in-loop
    await stampExe(target);
  }
}
