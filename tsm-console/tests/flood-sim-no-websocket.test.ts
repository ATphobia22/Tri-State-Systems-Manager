/**
 * tests/flood-sim-no-websocket.test.ts — wrapper so the standard
 * `npx vitest run tests/flood-sim-*.test.ts` glob executes the
 * source-grep transport gate that lives in
 * src/lib/flood-sim/no-websocket-gate.test.ts.
 *
 * Policy: all live data enters the flood simulator via REST polling
 * (`startGaugePoll`) plus the local deterministic engine. Push/streaming
 * transports are forbidden anywhere under src/lib/flood-sim/.
 */
import '../src/lib/flood-sim/no-websocket-gate.test';
