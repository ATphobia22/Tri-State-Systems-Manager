import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {
  MAX_GOVERNMENT_ARCHIVE_VERIFY_BYTES,
  verifyGovernmentArchiveBytes,
} from '../src/lib/government-snapshot-byte-verifier.ts';

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

function response(bytes, opts = {}) {
  const {status = 200, addLength = true} = opts;
  const headers = addLength ? {'content-length': String(bytes.byteLength)} : {};
  return new Response(bytes, {status, headers});
}
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
const url = 'https://government.example.gov/release.pmtiles';

test('accepts exact PMTiles archive bytes with original SHA256 and length', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 0, 255]);
  const result = await verifyGovernmentArchiveBytes(url, digest(bytes),
    {fetcher: async () => response(bytes)});
  assert.equal(result.bytesVerified, true);
  assert.equal(result.sha256, digest(bytes));
  assert.equal(result.byteLength, 7);
});

test('refuses a manipulated archive even when a manifest declares good hashes', async () => {
  const original = new Uint8Array([1, 2, 3]);
  const altered = new Uint8Array([1, 2, 4]);
  await assert.rejects(verifyGovernmentArchiveBytes(url, digest(original),
    {fetcher: async () => response(altered)}), /GOV_ARCHIVE_SHA256_MISMATCH/);
});

test('refuses empty, error, malformed and oversized archives without crashing viewer', async () => {
  const expected = digest(new Uint8Array([1]));
  await assert.rejects(verifyGovernmentArchiveBytes(url, expected,
    {fetcher: async () => response(new Uint8Array())}), /GOV_ARCHIVE_EMPTY/);
  await assert.rejects(verifyGovernmentArchiveBytes(url, expected,
    {fetcher: async () => new Response('unavailable', {status: 503})}), /GOV_ARCHIVE_FETCH_UNAVAILABLE/);
  await assert.rejects(verifyGovernmentArchiveBytes(url, 'garbage',
    {fetcher: async () => response(new Uint8Array([1]))}), /EXPECTED_SHA256_INVALID/);
  await assert.rejects(verifyGovernmentArchiveBytes(url, expected,
    {fetcher: async () => response(new Uint8Array([1, 2, 3])), maxBytes: 2}),
    /GOV_ARCHIVE_EXCEEDS_VERIFICATION_BUDGET/);
  assert.ok(MAX_GOVERNMENT_ARCHIVE_VERIFY_BYTES >= 1024 * 1024);
});

test('enforces byte limit even when server omits Content-Length', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  await assert.rejects(verifyGovernmentArchiveBytes(url, digest(bytes),
    {fetcher: async () => response(bytes, {addLength: false}), maxBytes: 2}),
    /GOV_ARCHIVE_EXCEEDS_VERIFICATION_BUDGET/);
});

test('does not silently accept HTTP 206 partial content as a full archive', async () => {
  const bytes = new Uint8Array([1]);
  await assert.rejects(verifyGovernmentArchiveBytes(url, digest(bytes),
    {fetcher: async () => new Response(bytes, {status: 206})}), /FETCH_UNAVAILABLE/);
});
