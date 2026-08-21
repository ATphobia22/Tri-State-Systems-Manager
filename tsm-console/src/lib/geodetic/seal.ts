import { siteSpatialReference, siteVerticalBoundary } from './site';

export async function sealGeodeticEvidence(payload: unknown): Promise<{
  content_hash_sha256: string;
  artifact_type: string;
  spatial_reference: ReturnType<typeof siteSpatialReference>;
  vertical_boundary: ReturnType<typeof siteVerticalBoundary>;
}> {
  const canonical = JSON.stringify(payload);
  const buf = new TextEncoder().encode('TSM_LEAF:' + canonical);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const content_hash_sha256 = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    content_hash_sha256,
    artifact_type: 'tsm.geodetic.evidence.v1',
    spatial_reference: siteSpatialReference(),
    vertical_boundary: siteVerticalBoundary(),
  };
}
