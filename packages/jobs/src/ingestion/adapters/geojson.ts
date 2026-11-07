/**
 * Pure-TypeScript GeoJSON adapter.
 *
 * Parses and validates a GeoJSON FeatureCollection from raw bytes, counts
 * the features it actually contains, and SHA-256-hashes the exact input
 * bytes. No binary, no network, no invented values: an empty collection
 * reports featureCount 0, and anything that is not a valid FeatureCollection
 * is REJECTED with a reason.
 */
import { createHash } from 'node:crypto';
import type {
  IngestionInput,
  IngestionManifest,
  IngestionResult,
} from '../../../contracts/src/IngestionManifest.js';

const SHA256_HEX = /^[a-f0-9]{64}$/;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function manifestForIngestedInput(
  input: IngestionInput,
  adapterName: string,
  featureCount?: number,
): IngestionManifest {
  const checksumSha256 = sha256Hex(input.bytes);
  return {
    runId: `ing_${checksumSha256.slice(0, 16)}`,
    sourceId: input.sourceId,
    sourceUri: input.sourceUri,
    datasetVersion: input.datasetVersion,
    assetKind: input.assetKind,
    checksumSha256,
    byteSize: input.bytes.length,
    featureCount,
    status: 'INGESTED',
    retrievedAt: new Date().toISOString(),
    adapterName,
    targetLayer: input.targetLayer,
  };
}

export class GeoJsonAdapter {
  readonly name = 'geojson';
  readonly supportedKinds = ['geojson'] as const;

  async ingest(input: IngestionInput): Promise<IngestionResult> {
    if (input.assetKind !== 'geojson') {
      return {
        status: 'REJECTED',
        reason: `GeoJsonAdapter supports assetKind 'geojson', got '${input.assetKind}'`,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(input.bytes));
    } catch (error) {
      return {
        status: 'REJECTED',
        reason: `GeoJSON input is not valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    if (typeof parsed !== 'object' || parsed === null || (parsed as { type?: unknown }).type !== 'FeatureCollection') {
      return { status: 'REJECTED', reason: "GeoJSON input is not a FeatureCollection (missing type 'FeatureCollection')" };
    }
    const features = (parsed as { features?: unknown }).features;
    if (!Array.isArray(features)) {
      return { status: 'REJECTED', reason: "GeoJSON FeatureCollection has no 'features' array" };
    }
    for (let i = 0; i < features.length; i += 1) {
      const feature = features[i] as { type?: unknown } | null;
      if (typeof feature !== 'object' || feature === null || feature.type !== 'Feature') {
        return { status: 'REJECTED', reason: `GeoJSON features[${i}] is not a Feature object` };
      }
    }
    const manifest = manifestForIngestedInput(input, this.name, features.length);
    if (!SHA256_HEX.test(manifest.checksumSha256)) {
      return { status: 'UNAVAILABLE', reason: 'Internal checksum failure: SHA-256 digest is malformed' };
    }
    return { status: 'INGESTED', manifest };
  }
}
