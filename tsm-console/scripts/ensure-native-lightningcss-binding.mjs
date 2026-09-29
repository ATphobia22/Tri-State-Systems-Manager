#!/usr/bin/env node
// Ensure the platform-specific lightningcss native binding is installed.
//
// Background: package-lock.json only records the linux lightningcss platform
// packages, so `npm ci` on Windows/macOS never installs
// `lightningcss-win32-x64-msvc` / `lightningcss-darwin-arm64`. Vite's CSS
// minifier then fails with:
//   [lightningcss minify] Cannot find module '../lightningcss.<platform>.node'
// This mirrors scripts/ensure-native-rolldown-binding.mjs (same install
// pattern, same no-save semantics).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';


const platform = process.platform;
const arch = process.arch;
const bindingByTarget = {
  'win32:x64': 'lightningcss-win32-x64-msvc',
  'win32:arm64': 'lightningcss-win32-arm64-msvc',
  'darwin:x64': 'lightningcss-darwin-x64',
  'darwin:arm64': 'lightningcss-darwin-arm64',
  'linux:x64': 'lightningcss-linux-x64-gnu',
  'linux:arm64': 'lightningcss-linux-arm64-gnu',
};
const bindingPackage = bindingByTarget[`${platform}:${arch}`];

if (!bindingPackage) {
  console.log(`lightningcss native binding is not required/known for ${platform}/${arch}; continuing.`);
  process.exit(0);
}

const lightningcssPackage = JSON.parse(
  fs.readFileSync(path.join('node_modules', 'lightningcss', 'package.json'), 'utf8'),
);
const version = lightningcssPackage.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Unexpected lightningcss version: ${version}`);
}

// NOTE: intentionally a filesystem check, not require.resolve(). Node's CJS
// resolver caches failed lookups per-process, so a resolve() issued before
// `npm install` would keep failing after the install within this process.
function bindingInstalled() {
  const dir = path.join('node_modules', bindingPackage);
  return fs.existsSync(path.join(dir, 'package.json'));
}

if (!bindingInstalled()) {
  console.log(`Installing missing platform binding ${bindingPackage}@${version} for ${platform}/${arch}.`);
  const npmArgs = [
    'install',
    '--no-save',
    '--package-lock=false',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--registry=https://registry.npmjs.org',
    `${bindingPackage}@${version}`,
  ];
  if (process.platform === 'win32') {
    execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm.cmd', ...npmArgs], {
      stdio: 'inherit',
      windowsVerbatimArguments: true,
    });
  } else {
    execFileSync('npm', npmArgs, { stdio: 'inherit' });
  }
}

if (!bindingInstalled()) {
  throw new Error(`lightningcss native binding remains unavailable: ${bindingPackage}`);
}

console.log(`lightningcss native binding verified: ${bindingPackage}@${version}`);
