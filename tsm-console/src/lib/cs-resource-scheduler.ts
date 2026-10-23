/**
 * C/S (complexity / semantic-depth) resource scheduler — plan generator.
 *
 * swap_enabled remains false until real variants are registered.
 * Presentation only.
 */

export interface CsAsset {
  readonly id: string;
  readonly kind: string;
  readonly complexity: string;
  readonly semantic_depth: string;
  readonly uri_template: string | null;
  readonly sha256: string | null;
  readonly status: string;
}

export interface CsManifest {
  readonly registry_id: string;
  readonly scheduler: {
    readonly mode: string;
    readonly swap_enabled: boolean;
    readonly reason?: string;
  };
  readonly assets: readonly CsAsset[];
  readonly network_resource_policy: {
    readonly allow_unregistered_fetch: boolean;
    readonly require_provenance_uri: boolean;
    readonly require_sha256: boolean;
  };
}

export interface CsSwapPlan {
  readonly requestedComplexity: string;
  readonly requestedSemantic: string;
  readonly selectedAssetId: string | null;
  readonly action: 'none' | 'plan_only' | 'swap';
  readonly reason: string;
}

export function planCsSwap(
  manifest: CsManifest,
  requestedComplexity: string,
  requestedSemantic: string,
): CsSwapPlan {
  if (!manifest.scheduler.swap_enabled) {
    return {
      requestedComplexity,
      requestedSemantic,
      selectedAssetId: null,
      action: 'plan_only',
      reason: manifest.scheduler.reason ?? 'swap_enabled=false',
    };
  }
  const match = manifest.assets.find(
    (a) =>
      a.complexity === requestedComplexity &&
      a.semantic_depth === requestedSemantic &&
      a.status === 'REGISTERED' &&
      a.uri_template &&
      a.sha256,
  );
  if (!match) {
    return {
      requestedComplexity,
      requestedSemantic,
      selectedAssetId: null,
      action: 'none',
      reason: 'No REGISTERED C/S variant with uri+sha256',
    };
  }
  if (manifest.network_resource_policy.require_sha256 && !match.sha256) {
    return {
      requestedComplexity,
      requestedSemantic,
      selectedAssetId: null,
      action: 'none',
      reason: 'SHA-256 required by policy',
    };
  }
  return {
    requestedComplexity,
    requestedSemantic,
    selectedAssetId: match.id,
    action: 'swap',
    reason: 'Registered variant selected',
  };
}
