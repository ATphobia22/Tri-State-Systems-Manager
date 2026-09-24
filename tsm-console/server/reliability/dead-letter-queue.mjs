import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DEFAULT_LIMIT = 1_000;

export function createDeadLetterQueue({
  filePath = path.join(process.cwd(), '.data', 'dead-letter-queue.json'),
  maxEntries = DEFAULT_LIMIT,
} = {}) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError('maxEntries must be >= 1');

  function ensureDirectory() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  function load() {
    ensureDirectory();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('dead-letter queue must contain an array');
    return parsed;
  }

  function enqueue(message, reason = 'UNPROCESSABLE') {
    if (message === undefined) throw new TypeError('message is required');
    const entries = load();
    entries.push({
      id: randomUUID(),
      enqueuedAt: new Date().toISOString(),
      reason,
      message,
    });
    const retained = entries.slice(-maxEntries);
    ensureDirectory();
    const temporary = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(retained, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, filePath);
    return retained.at(-1);
  }

  function list(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be >= 1');
    return load().slice(-limit);
  }

  return Object.freeze({ enqueue, list });
}
