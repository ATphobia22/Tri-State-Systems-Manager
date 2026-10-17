import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/lib/session-live-shadow.ts'), 'utf8');
assert.match(src, /LIVE_SHADOW_POLL_MS/);
assert.match(src, /LIVE_SHADOW_STALE_MS/);
assert.match(src, /LIVE_SHADOW_MAX_SESSION_MS/);
assert.match(src, /class SessionLiveShadow/);
assert.match(src, /auto_stop_max_session/);
console.log('session-live-shadow-contract: OK');
