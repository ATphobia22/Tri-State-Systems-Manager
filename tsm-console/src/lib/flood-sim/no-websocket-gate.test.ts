/**
 * no-websocket-gate.test.ts — source-grep gate: the flood simulator must
 * NEVER use websockets, socket.io, EventSource (SSE), or MQTT.
 *
 * All live data enters via REST polling (`startGaugePoll` from
 * ../river-gauges) plus the local deterministic engine. This test reads
 * every file under src/lib/flood-sim/ and fails on any match of the
 * forbidden transports — including inside comments, so even *mentioning*
 * them in prose must go through this allowlist note (this file's own
 * docstring is the only permitted mention, and it is excluded by scoping
 * the scan to non-test source files... see below).
 *
 * NOTE: this file documents the forbidden tokens, so the scanner skips
 * *.test.ts files — but the tokens still must not appear in any shipped
 * source file under src/lib/flood-sim/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

// Forbidden transports: WebSocket API, socket.io, Server-Sent Events, MQTT.
const FORBIDDEN = /WebSocket|socket\.io|EventSource|mqtt/i;

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('no-websocket gate (flood-sim)', () => {
  it('contains no WebSocket/socket.io/EventSource/MQTT references in shipped source', () => {
    const files = collectSourceFiles(HERE);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // Strip the docstring line that names this gate's own policy tokens is
      // unnecessary: test files are excluded from the scan entirely, and this
      // file IS a test file, so its mentions cannot trip the gate.
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (FORBIDDEN.test(line)) {
          violations.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('documents the REST-only data path in the package index', () => {
    const index = readFileSync(join(HERE, 'index.ts'), 'utf8');
    expect(index).toMatch(/REST polling/i);
    expect(index).toMatch(/startGaugePoll/);
  });
});
