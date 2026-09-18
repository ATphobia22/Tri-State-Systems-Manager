#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

interface EvidenceEntry { path: string; bytes: number; sha256: string; }
interface EvidenceManifest { schema: string; generatedAt: string; algorithm: 'sha256'; entries: EvidenceEntry[]; manifestSha256?: string; }

async function hashFile(path: string): Promise<EvidenceEntry> {
  const data = await readFile(path);
  const info = await stat(path);
  return { path, bytes: info.size, sha256: createHash('sha256').update(data).digest('hex') };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? resolve(args[outputIndex + 1]) : resolve('evidence-manifest.json');
  const inputs = args.filter((arg, i) => !arg.startsWith('--') && i !== outputIndex + 1).map(resolve);
  if (!inputs.length) throw new Error('usage: sign-evidence.ts [--output manifest.json] <file>...');
  const entries = (await Promise.all(inputs.map(hashFile))).sort((a, b) => a.path.localeCompare(b.path));
  const unsigned = { schema: 'tsm.evidence-manifest.v1', generatedAt: 'DETERMINISTIC', algorithm: 'sha256', entries };
  const canonical = JSON.stringify(unsigned);
  const manifestSha256 = createHash('sha256').update(canonical).digest('hex');
  await writeFile(output, JSON.stringify({ ...unsigned, manifestSha256 }, null, 2) + '\n', 'utf8');
  process.stdout.write(`signed ${entries.length} evidence files -> ${basename(output)}\n`);
}

main().catch((error) => { process.stderr.write(`sign-evidence: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
