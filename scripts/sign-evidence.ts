#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';

interface EvidenceEntry {
  path: string;
  bytes: number;
  sha256: string;
}

interface EvidenceManifest {
  schema: string;
  generatedAt: string;
  algorithm: 'sha256';
  entries: EvidenceEntry[];
  manifestSha256?: string;
}

const root = resolve(process.cwd());

function stablePath(path: string): string {
  const absolute = resolve(path);
  const rel = relative(root, absolute);

  if (!rel || rel === '..' || rel.startsWith('..' + sep) || absolute === root) {
    throw new Error(`evidence path must remain inside repository root: ${path}`);
  }

  return rel.split(sep).join('/');
}

async function hashFile(path: string): Promise<EvidenceEntry> {
  const data = await readFile(path);
  const info = await stat(path);
  return {
    path: stablePath(path),
    bytes: info.size,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');

  if (outputIndex >= 0 && (!args[outputIndex + 1] || args[outputIndex + 1].startsWith('--'))) {
    throw new Error('--output requires a path');
  }

  const output = outputIndex >= 0
    ? resolve(args[outputIndex + 1])
    : resolve('evidence-manifest.json');

  const inputs = args
    .filter((arg, index) => !arg.startsWith('--') && index !== outputIndex + 1)
    .map(resolve);

  if (!inputs.length) {
    throw new Error('usage: sign-evidence.ts [--output manifest.json] <file>...');
  }

  stablePath(output);

  const outputPath = output.toString();
  const inputPaths = new Set(inputs.map((input) => input.toString()));
  if (inputPaths.has(outputPath)) {
    throw new Error('evidence output must not also be an input');
  }

  const entries = (await Promise.all(inputs.map(hashFile)))
    .sort((a, b) => a.path.localeCompare(b.path));

  const unsigned = {
    schema: 'tsm.evidence-manifest.v1',
    generatedAt: 'DETERMINISTIC',
    algorithm: 'sha256' as const,
    entries,
  };

  const canonical = JSON.stringify(unsigned);
  const manifestSha256 = createHash('sha256').update(canonical).digest('hex');

  await writeFile(
    output,
    JSON.stringify({ ...unsigned, manifestSha256 }, null, 2) + '\n',
    'utf8',
  );

  process.stdout.write(`hashed ${entries.length} evidence files -> ${basename(output)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `sign-evidence: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
