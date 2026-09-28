#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const platform = process.platform;
const arch = process.arch;
const bindingByTarget = {
  'win32:x64': '@rolldown/binding-win32-x64-msvc',
  'win32:arm64': '@rolldown/binding-win32-arm64-msvc',
  'darwin:x64': '@rolldown/binding-darwin-x64',
  'darwin:arm64': '@rolldown/binding-darwin-arm64',
  'linux:x64': '@rolldown/binding-linux-x64-gnu',
  'linux:arm64': '@rolldown/binding-linux-arm64-gnu',
};
const bindingPackage = bindingByTarget[`${platform}:${arch}`];

if (!bindingPackage) {
  console.log(`Rolldown native binding is not required/known for ${platform}/${arch}; continuing.`);
  process.exit(0);
}

const rolldownPackage = JSON.parse(
  fs.readFileSync(path.join('node_modules', 'rolldown', 'package.json'), 'utf8'),
);
const version = rolldownPackage.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Unexpected Rolldown version: ${version}`);
}

const bindingPath = path.join('node_modules', ...bindingPackage.split('/'));
if (!fs.existsSync(bindingPath)) {
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

if (!fs.existsSync(bindingPath)) {
  throw new Error(`Rolldown native binding remains unavailable: ${bindingPackage}`);
}

console.log(`Rolldown native binding verified: ${bindingPackage}@${version}`);
