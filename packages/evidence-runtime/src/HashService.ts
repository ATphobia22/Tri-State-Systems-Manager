import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function sha256File(path: string): Promise<string> {
  return sha256(await readFile(path));
}
