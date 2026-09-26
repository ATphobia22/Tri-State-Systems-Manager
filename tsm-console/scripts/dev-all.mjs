#!/usr/bin/env node
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['run', 'dev'], { stdio: 'inherit', env: process.env }),
  spawn(npm, ['run', 'proxy'], { stdio: 'inherit', env: process.env }),
];

let shuttingDown = false;
const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 1000).unref();
};

for (const child of children) {
  child.on('error', (error) => {
    console.error('[dev:all] child process error:', error);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev:all] child exited with code=${code ?? 'null'} signal=${signal ?? 'none'}`);
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
