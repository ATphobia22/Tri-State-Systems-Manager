/** Source-evidence boundary for Cesium ion and offline 3D Tiles. */
export type TsmIonAssetKey = 'poseyLod2Buildings' | 'posey3depTerrain' | 'poseyOrtho';
export type VerifiedIonReceipt = {
  assetId: number;
  status: 'COMPLETE';
  sourceSha256: string;
  tilingCompletedAt: string;
  licenseReviewed: true;
  sourceDatumReviewed: true;
};
export type LocalAssetReceipt = {
  relativePath: string;
  sha256: string;
  manifestVerified: true;
  licenseReviewed: true;
};
export type SceneChoice =
  | { source: 'OFFLINE_LOCAL'; url: string; sha256: string }
  | { source: 'ION'; assetId: number; sourceSha256?: string }
  | { source: 'SOURCE_UNAVAILABLE'; reason: string };

const SHA256 = /^[a-f0-9]{64}$/i;
const EXPECTED: Record<TsmIonAssetKey, number> = {
  poseyLod2Buildings: 6155963, posey3depTerrain: 6155965, poseyOrtho: 6155967,
};
const CATALOG: Record<TsmIonAssetKey, number> = {
  poseyLod2Buildings: 96188, posey3depTerrain: 1, poseyOrtho: 2,
};

/** Never request ion in an offline build. Ion asset IDs alone do not prove upload or tiling. */
export function chooseCesiumAsset(
  key: TsmIonAssetKey,
  options: {
    networkAllowed: boolean;
    ionTokenConfigured: boolean;
    ionReceipt?: VerifiedIonReceipt;
    localReceipt?: LocalAssetReceipt;
  },
): SceneChoice {
  const local = options.localReceipt;
  if (local && local.manifestVerified && local.licenseReviewed
      && SHA256.test(local.sha256)
      && /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+\.(?:json|xml)$/.test(local.relativePath)
      && !local.relativePath.includes('//')) {
    return { source: 'OFFLINE_LOCAL', url: local.relativePath, sha256: local.sha256.toLowerCase() };
  }
  if (!options.networkAllowed || !options.ionTokenConfigured) {
    return { source: 'SOURCE_UNAVAILABLE', reason: 'No verified local asset and remote ion access disabled' };
  }
  const receipt = options.ionReceipt;
  if (receipt?.status === 'COMPLETE'
      && receipt.assetId === EXPECTED[key]
      && SHA256.test(receipt.sourceSha256)
      && receipt.licenseReviewed && receipt.sourceDatumReviewed
      && Number.isFinite(Date.parse(receipt.tilingCompletedAt))) {
    return { source: 'ION', assetId: receipt.assetId, sourceSha256: receipt.sourceSha256.toLowerCase() };
  }
  return { source: 'ION', assetId: CATALOG[key] }; // online context-only fallback; not survey evidence
}
