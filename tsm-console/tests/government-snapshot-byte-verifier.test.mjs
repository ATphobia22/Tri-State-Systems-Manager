import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {
  MAX_GOVERNMENT_ARCHIVE_VERIFY_BYTES,
  verifyGovernmentArchiveBytes,
  probeGovernmentArchiveRange,
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

const prefix = new Uint8Array([80,77,84,105,108,101,115,3]);
function partial(bytes=prefix, contentRange='bytes 0-7/500000000', status=206) {
  return new Response(bytes, {status, headers:{'content-range':contentRange}});
}
test('accepts a bounded PMTiles v3 range and exposes total archive size', async () => {
  const result=await probeGovernmentArchiveRange(url,{fetcher:async (_url,init)=>{
    assert.equal(new Headers(init.headers).get('range'),'bytes=0-7');
    assert.equal(init.redirect,'error');
    return partial();
  }});
  assert.equal(result.archiveByteLength,500000000);
});
test('rejects a range-ignoring server and cancels the full response',async()=>{
  let cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(probeGovernmentArchiveRange(url,{fetcher:async()=>new Response(body,{status:200})}),/GOV_ARCHIVE_RANGE_UNAVAILABLE/);
  assert.equal(cancelled,true);
});
test('rejects unexposed, incorrect, and impossible Content-Range values',async()=>{
  for(const range of ['', 'bytes 1-8/500000000','bytes 0-7/*','bytes 0-7/8','bytes 0-7/999999999999999999999']){
    await assert.rejects(probeGovernmentArchiveRange(url,{fetcher:async()=>partial(prefix,range)}),/GOV_ARCHIVE_CONTENT_RANGE_INVALID/);
  }
});
test('rejects non-PMTiles or truncated responses and extra bytes',async()=>{
  for(const bytes of [new Uint8Array(8),prefix.slice(0,7),new Uint8Array([...prefix,0]),new Uint8Array([...prefix.slice(0,7),2])]){
    await assert.rejects(probeGovernmentArchiveRange(url,{fetcher:async()=>partial(bytes)}),/GOV_ARCHIVE_RANGE_PAYLOAD_INVALID/);
  }
});
