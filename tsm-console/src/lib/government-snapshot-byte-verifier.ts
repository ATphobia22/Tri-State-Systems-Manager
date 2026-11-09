/** Bounded browser-side digest verification for archived government PMTiles.
 *
 * This checks actual archive bytes, not merely the presence of a SHA-256 string
 * in a release manifest. A failure degrades ONE optional map layer; the 3D
 * viewer, terrain, and all other sources must remain usable.
 */
export interface GovernmentArchiveDigestResult {
  readonly bytesVerified: true;
  readonly sha256: string;
  readonly byteLength: number;
}
export interface ArchiveDigestOptions {
  readonly signal?: AbortSignal;
  readonly maxBytes?: number;
  readonly fetcher?: typeof fetch;
}
const SHA256 = /^[a-f0-9]{64}$/;
export const MAX_GOVERNMENT_ARCHIVE_VERIFY_BYTES = 128 * 1024 * 1024;

export async function verifyGovernmentArchiveBytes(
  url: string, expectedSha256: string, options: ArchiveDigestOptions = {},
): Promise<GovernmentArchiveDigestResult> {
  if (!SHA256.test(expectedSha256)) throw Error('GOV_ARCHIVE_EXPECTED_SHA256_INVALID');
  const budget = options.maxBytes ?? MAX_GOVERNMENT_ARCHIVE_VERIFY_BYTES;
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > MAX_GOVERNMENT_ARCHIVE_VERIFY_BYTES) {
    throw Error('GOV_ARCHIVE_VERIFY_BUDGET_INVALID');
  }
  const response = await (options.fetcher ?? fetch)(url, {
    signal: options.signal, redirect: 'error', cache: 'no-store',
  });
  if (!response.ok || response.status !== 200 || !response.body) {
    throw Error('GOV_ARCHIVE_FETCH_UNAVAILABLE');
  }
  const declaredSize = response.headers.get('content-length');
  if (declaredSize && (!/^\d+$/.test(declaredSize) || Number(declaredSize) > budget)) {
    await response.body.cancel();
    throw Error('GOV_ARCHIVE_EXCEEDS_VERIFICATION_BUDGET');
  }
  const stream = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) break;
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > budget) {
        await stream.cancel();
        throw Error('GOV_ARCHIVE_EXCEEDS_VERIFICATION_BUDGET');
      }
      chunks.push(value);
    }
  } finally {
    stream.releaseLock();
  }
  if (byteLength === 0) throw Error('GOV_ARCHIVE_EMPTY');
  const full = new Uint8Array(byteLength);
  let cursor = 0;
  for (const chunk of chunks) {
    full.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  // Explicit owned ArrayBuffer to satisfy WebCrypto's stricter TS ArrayBuffer type.
  const bytes = new Uint8Array(byteLength);
  bytes.set(full);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.buffer));
  const sha256 = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
  if (sha256 !== expectedSha256) throw Error('GOV_ARCHIVE_SHA256_MISMATCH');
  return { bytesVerified: true, sha256, byteLength };
}
