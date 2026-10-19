/**
 * tests/flood-sim-no-websocket.test.ts — wrapper so the standard
 * `npx vitest run tests/flood-sim-*.test.ts` glob executes the
 * source-grep transport gate that lives in
 * src/lib/flood-sim/no-websocket-gate.test.ts.
 *
 * Policy: the simulator uses interval HTTPS terrain-health probes plus its
 * local deterministic engine. User-triggered river snapshots are outside the
 * simulator; automatic gauge polling and push/streaming transports are forbidden.
 */
import '../src/lib/flood-sim/no-websocket-gate.test';
