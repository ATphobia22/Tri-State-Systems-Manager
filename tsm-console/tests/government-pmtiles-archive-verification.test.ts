import {afterEach, describe, expect, it, vi} from 'vitest';
import {createHash,webcrypto} from 'node:crypto';
import {verifyGovernmentArchiveBytes} from '../src/lib/government-pmtiles-overlay';

const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
afterEach(()=>vi.unstubAllGlobals());

describe('optional government archive byte admission',()=>{
  it('loads a historical archive only when original bytes match SHA-256',async()=>{
    vi.stubGlobal('crypto',webcrypto);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('verified-offline-archive',{status:200})));
    await expect(verifyGovernmentArchiveBytes('https://example.gov/archived.pmtiles',
      sha('verified-offline-archive'))).resolves.toBeUndefined();
  });
  it('rejects mutated archive even with an otherwise valid manifest hash',async()=>{
    vi.stubGlobal('crypto',webcrypto);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('tampered-archive',{status:200})));
    await expect(verifyGovernmentArchiveBytes('https://example.gov/archived.pmtiles',
      sha('verified-offline-archive'))).rejects.toThrow('GOVERNMENT_ARCHIVE_SHA256_MISMATCH');
  });
  it('refuses unbounded archive transfer before buffering',async()=>{
    vi.stubGlobal('crypto',webcrypto);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('fake',{status:200,
      headers:{'content-length':String(129*1024*1024)}})));
    await expect(verifyGovernmentArchiveBytes('https://example.gov/archived.pmtiles',
      sha('fake'))).rejects.toThrow('GOVERNMENT_ARCHIVE_EXCEEDS_VERIFICATION_LIMIT');
  });
  it('does not substitute network failures with unverified scene content',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('network unavailable');}));
    await expect(verifyGovernmentArchiveBytes('https://example.gov/archived.pmtiles',
      sha('fake'))).rejects.toThrow('network unavailable');
  });
  it('rejects invalid claimed digest',async()=>{
    await expect(verifyGovernmentArchiveBytes('https://example.gov/archived.pmtiles',
      'UNVERIFIED')).rejects.toThrow('GOVERNMENT_ARCHIVE_DIGEST_REQUIRED');
  });
});
