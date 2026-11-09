import type {Map as MapLibreMap} from 'maplibre-gl';
import {ensureProtocolRegistered} from './pmtiles-overlay';
import {toPmtilesSourceUrl} from './pmtiles-fabric';
import {registerGovernmentVectorLayer, type GovernmentTileManifest} from '../../../packages/government/src/layers/maplibreGovernmentLayers';
import {
  isVerifiedHistoricalSnapshot, parseGovDate, snapshotIsStale,
  ALLOWED_GOVERNMENT_AGENCIES, type GovernmentSnapshotDescriptor,
  type GovernmentReleaseReceipt,
} from './government-snapshot-policy';

/** Government archive failure affects this overlay ONLY, never the 3D twin canvas.
 * Historical archives require a release receipt AND a freshly recomputed archive
 * SHA-256 at runtime. This is byte-integrity evidence, not regulatory approval.
 */
export type SceneSourceStatus =
  | 'CHECKING_GOVERNMENT_SNAPSHOT'
  | 'CURRENT_GOVERNMENT_SNAPSHOT'
  | 'HISTORICAL_GOVERNMENT_FALLBACK'
  | 'NO_GOVERNMENT_SNAPSHOT';

export interface GovernmentSceneDetail {
  status: SceneSourceStatus;
  agency: string | null;
  capturedAt: string | null;
  source: string | null;
  sourceVersion: string | null;
  datasetId: string | null;
  validation: string | null;
  tilesSha256: string | null;
  sourceSha256: string | null;
  merkleRootSha256: string | null;
  archiveBytesVerified: boolean;
  sourceBytesIndependentlyVerified: false;
  authoritativeEngineeringUse: false;
  regulatoryApproval: false;
  reason: string;
}

type ArchiveManifest = GovernmentTileManifest & GovernmentReleaseReceipt & {
  sourceUrl?: string;
  retrievedAt?: string;
  createdAt?: string;
};
const SHA = /^[0-9a-f]{64}$/;
const AGE_DAYS = 30;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
export const GOVERNMENT_SCENE_STATUS_EVENT = 'tsm:government-scene-status';

function safeAssetUrl(value:string): string {
  if(!value || /\s/.test(value)) throw Error('GOVERNMENT_ARCHIVE_URL_MALFORMED');
  const target = new URL(value, window.location.href);
  if(target.username || target.password) throw Error('GOVERNMENT_ARCHIVE_CREDENTIAL_URL_FORBIDDEN');
  if(target.protocol !== 'https:' && !(target.origin === window.location.origin && target.protocol === 'http:'))
    throw Error('GOVERNMENT_ARCHIVE_SOURCE_MUST_BE_HTTPS_OR_LOCAL');
  return target.toString();
}

function sourceRecordUrl(value: string): string {
  const url = new URL(value);
  if(url.protocol !== 'https:' || url.username || url.password) throw Error('GOVERNMENT_SOURCE_RECORD_NOT_HTTPS');
  return url.toString();
}

function fallbackEntries(): GovernmentSnapshotDescriptor[] {
  const raw = import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_FALLBACKS?.trim();
  if(!raw) return [];
  try {
    const rows: unknown = JSON.parse(raw);
    if(!Array.isArray(rows) || rows.length > 20) throw Error('GOVERNMENT_ARCHIVE_FALLBACK_LIST_INVALID');
    const valid = rows.map((row: unknown): GovernmentSnapshotDescriptor => {
      if(!row || typeof row !== 'object') throw Error('GOVERNMENT_ARCHIVE_ENTRY_INVALID');
      const entry = row as Record<string,unknown>;
      for(const key of ['manifestUrl','archiveUrl','agency','capturedAt','sourceRecordUrl']) {
        if(typeof entry[key] !== 'string' || !(entry[key] as string).trim())
          throw Error('GOVERNMENT_ARCHIVE_FIELD_REQUIRED:' + key);
      }
      const result = entry as unknown as GovernmentSnapshotDescriptor;
      if(!ALLOWED_GOVERNMENT_AGENCIES.has(result.agency.toUpperCase().trim()))
        throw Error('GOVERNMENT_ARCHIVE_AGENCY_NOT_ALLOWLISTED');
      if(!Number.isFinite(parseGovDate(result.capturedAt)) || parseGovDate(result.capturedAt) > Date.now())
        throw Error('GOVERNMENT_ARCHIVE_CAPTURE_DATE_INVALID');
      sourceRecordUrl(result.sourceRecordUrl);
      safeAssetUrl(result.manifestUrl);
      safeAssetUrl(result.archiveUrl);
      return result;
    });
    return valid.sort((a,b) => parseGovDate(b.capturedAt) - parseGovDate(a.capturedAt));
  } catch(error) {
    console.warn('Government historical archive catalog invalid; other map layers remain available.',error);
    return [];
  }
}

function announce(detail: GovernmentSceneDetail): void {
  window.dispatchEvent(new CustomEvent<GovernmentSceneDetail>(GOVERNMENT_SCENE_STATUS_EVENT,{detail}));
}

function emptyScene(reason:string, status:SceneSourceStatus = 'NO_GOVERNMENT_SNAPSHOT'): GovernmentSceneDetail {
  return {
    status, agency:null, capturedAt:null, source:null, sourceVersion:null, datasetId:null,
    validation:null, tilesSha256:null, sourceSha256:null, merkleRootSha256:null,
    archiveBytesVerified:false, sourceBytesIndependentlyVerified:false,
    authoritativeEngineeringUse:false, regulatoryApproval:false, reason,
  };
}

/** Bounded whole-file SHA-256 before mounting PMTiles. Reject oversized archives,
 * truncated streams, redirects, mismatched bytes and offline network failures.
 * A different delivery scheme is required for >128 MiB archives; never bypass
 * checksum verification merely to make a layer appear.
 */
export async function verifyGovernmentArchiveBytes(
  archiveUrl: string, expectedSha256: string, signal?: AbortSignal,
): Promise<void> {
  if(!SHA.test(expectedSha256)) throw Error('GOVERNMENT_ARCHIVE_DIGEST_REQUIRED');
  const response = await fetch(archiveUrl, {signal, redirect:'error', cache:'no-store'});
  if(!response.ok) throw Error('GOVERNMENT_ARCHIVE_HTTP_' + response.status);
  const declaredLength = Number(response.headers.get('content-length'));
  if(Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_BYTES)
    throw Error('GOVERNMENT_ARCHIVE_EXCEEDS_VERIFICATION_LIMIT');
  const chunks:Uint8Array[] = [];
  let total = 0;
  if(response.body) {
    const reader = response.body.getReader();
    try {
      while(true) {
        const {done, value} = await reader.read();
        if(done) break;
        total += value.byteLength;
        if(total > MAX_ARCHIVE_BYTES) throw Error('GOVERNMENT_ARCHIVE_EXCEEDS_VERIFICATION_LIMIT');
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer());
    total = bytes.byteLength;
    if(total > MAX_ARCHIVE_BYTES) throw Error('GOVERNMENT_ARCHIVE_EXCEEDS_VERIFICATION_LIMIT');
    chunks.push(bytes);
  }
  if(total === 0) throw Error('GOVERNMENT_ARCHIVE_EMPTY');
  const buffer = new Uint8Array(total);
  let offset = 0;
  for(const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  if(signal?.aborted) throw Error('GOVERNMENT_ARCHIVE_VERIFICATION_CANCELLED');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer.buffer));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2,'0')).join('');
  if(actual !== expectedSha256) throw Error('GOVERNMENT_ARCHIVE_SHA256_MISMATCH');
}

interface SourceChoice { manifestUrl:string; archiveUrl:string; fallback?:GovernmentSnapshotDescriptor; }
function candidateList(): SourceChoice[] {
  const result:SourceChoice[] = [];
  const currentManifest = import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_MANIFEST?.trim();
  const currentArchive = import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_URL?.trim();
  if(currentManifest && currentArchive) result.push({manifestUrl:currentManifest,archiveUrl:currentArchive});
  for(const fallback of fallbackEntries()) result.push({
    manifestUrl:fallback.manifestUrl, archiveUrl:fallback.archiveUrl, fallback,
  });
  return result;
}

/** Keep MapLibre + independently staged 3D terrain operational regardless of service state. */
export function attachGovernmentPmtilesLayer(map:MapLibreMap):()=>void {
  const candidates = candidateList();
  const abort = new AbortController();
  let layerId:string|null = null, sourceId:string|null = null;
  announce(emptyScene('Checking locally staged or configured government archive.',
                      'CHECKING_GOVERNMENT_SNAPSHOT'));
  (async () => {
    for(const choice of candidates) {
      if(abort.signal.aborted) return;
      try {
        const manifestUrl = safeAssetUrl(choice.manifestUrl);
        const archiveUrl = safeAssetUrl(choice.archiveUrl);
        const response = await fetch(manifestUrl, {signal:abort.signal,redirect:'error',cache:'no-store'});
        if(!response.ok) throw Error('GOVERNMENT_MANIFEST_HTTP_' + response.status);
        const body = await response.text();
        if(body.length > 100_000) throw Error('GOVERNMENT_MANIFEST_TOO_LARGE');
        const manifest = JSON.parse(body) as ArchiveManifest;
        if(!manifest || !SHA.test(manifest.tilesSha256) || !SHA.test(manifest.sourceSha256)
           || !manifest.datasetId || !manifest.attribution
           || !['VERIFIED','BUILT_NOT_FIELD_VERIFIED'].includes(manifest.validation)
           || !manifest.retrievedAt || !Number.isFinite(parseGovDate(manifest.retrievedAt))
           || parseGovDate(manifest.retrievedAt) > Date.now()
           || !manifest.sourceUrl) throw Error('GOVERNMENT_MANIFEST_PROVENANCE_INCOMPLETE');
        const source = sourceRecordUrl(manifest.sourceUrl);
        const historical = !!choice.fallback || snapshotIsStale(manifest.retrievedAt, Date.now(), AGE_DAYS);
        if(historical) {
          const descriptor: GovernmentSnapshotDescriptor = choice.fallback ?? {
            manifestUrl, archiveUrl, agency:manifest.attribution,
            capturedAt:manifest.retrievedAt, sourceRecordUrl:source,
          };
          if(sourceRecordUrl(descriptor.sourceRecordUrl) !== source
             || parseGovDate(descriptor.capturedAt) !== parseGovDate(manifest.retrievedAt)
             || !isVerifiedHistoricalSnapshot(descriptor, manifest)) {
            throw Error('GOVERNMENT_HISTORICAL_RELEASE_RECEIPT_NOT_VERIFIED');
          }
        }
        // The metadata hash alone is not evidence: hash the actual PMTiles bytes.
        await verifyGovernmentArchiveBytes(archiveUrl, manifest.tilesSha256, abort.signal);
        if(abort.signal.aborted) return;
        ensureProtocolRegistered();
        const pmtiles = toPmtilesSourceUrl({
          id:'government-offline', archiveUrl, attribution:manifest.attribution, enabled:true,
        });
        const ids = registerGovernmentVectorLayer(map as never, {
          id:'tsm_authoritative',archiveUrl:pmtiles,manifest,visible:true,
          color:historical?'#ad9141':'#117f9b',
        });
        sourceId = ids.sourceId; layerId = ids.layerId;
        announce({
          status:historical?'HISTORICAL_GOVERNMENT_FALLBACK':'CURRENT_GOVERNMENT_SNAPSHOT',
          agency:choice.fallback?.agency??manifest.attribution,
          capturedAt:manifest.retrievedAt, source, sourceVersion:manifest.sourceVersion??null,
          datasetId:manifest.datasetId, validation:manifest.validation,
          tilesSha256:manifest.tilesSha256, sourceSha256:manifest.sourceSha256,
          merkleRootSha256:manifest.merkleRootSha256??null,
          archiveBytesVerified:true, sourceBytesIndependentlyVerified:false,
          authoritativeEngineeringUse:false, regulatoryApproval:false,
          reason:historical
            ? 'HISTORICAL SNAPSHOT; archive SHA-256 checked. Retrieval date is not acquisition vintage or current FEMA authority.'
            : 'Archive SHA-256 checked. Retrieval date within 30 days; live status and field accuracy not certified.',
        });
        return;
      } catch(error) {
        if(!abort.signal.aborted)
          console.warn('Optional government archive unavailable or not verified; trying older snapshot.',error);
      }
    }
    if(!abort.signal.aborted) announce(emptyScene(
      'No usable integrity-verified government archive; the independent base map and 3D scene remain available. Historical values are not substituted as live measurements.',
    ));
  })();
  return () => {
    abort.abort();
    try {
      if(layerId && map.getLayer(layerId)) map.removeLayer(layerId);
      if(sourceId && map.getSource(sourceId)) map.removeSource(sourceId);
    } catch { /* MapLibre may already be disposed. */ }
  };
}
