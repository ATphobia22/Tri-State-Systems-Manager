import type { IndianaFeatureKind, IndianaFeatureStatus } from './open-world-feature-fabric';

/**
 * Source-to-renderer traceability for the twelve structural planes.
 * Registry membership is not evidence that a map asset, 3D mesh or model is ready.
 */
export type PlaneAuthority = 'OBSERVATION' | 'REGULATORY' | 'PLANNING' | 'CONTEXT'
  | 'DERIVED' | 'MODEL_OUTPUT' | 'PRESENTATION';

export type PlaneBinding =
  | { readonly kind: 'map'; readonly layerId: string }
  | { readonly kind: 'terrain' }
  | { readonly kind: 'reference-marker' }
  | { readonly kind: 'feature'; readonly feature: IndianaFeatureKind }
  | { readonly kind: 'model'; readonly layerId: string }
  | { readonly kind: 'presentation' }
  | { readonly kind: 'unwired' };

export interface OpenWorldPlane {
  readonly index: number;
  readonly id: string;
  readonly title: string;
  readonly authority: PlaneAuthority;
  readonly binding: PlaneBinding;
  readonly limitation: string;
}

export const OPEN_WORLD_PLANES: readonly OpenWorldPlane[] = [
  { index: 1, id: 'terrain', title: 'Continuous DEM terrain', authority: 'DERIVED',
    binding: { kind: 'terrain' }, limitation: 'Requires georeferenced Terrain-RGB; rendered geometry is not surveyed terrain.' },
  { index: 2, id: 'bathymetry', title: 'Hydrographic bathymetry', authority: 'OBSERVATION',
    binding: { kind: 'unwired' }, limitation: 'eHydro survey extents are not a continuous NAVD88 riverbed mesh.' },
  { index: 3, id: 'gage-datum', title: 'NAVD88 gage-zero conversions', authority: 'OBSERVATION',
    binding: { kind: 'unwired' }, limitation: 'Computed elevation needs validated station zero, datum and observation time.' },
  { index: 4, id: 'hec-ras', title: 'HEC-RAS 2D hydraulic surfaces', authority: 'MODEL_OUTPUT',
    binding: { kind: 'model', layerId: 'tsm-hydraulic-extrusion' }, limitation: 'Runtime layer alone does not validate HEC-RAS model input, calibration or regulatory use.' },
  { index: 5, id: 'fema', title: 'FEMA effective NFHL', authority: 'REGULATORY',
    binding: { kind: 'map', layerId: 'fema-nfhl-overlay' }, limitation: 'Regulatory map reference only, not a parcel-specific FEMA determination.' },
  { index: 6, id: 'indiana-bafm', title: 'Indiana DNR best available flood hazard', authority: 'PLANNING',
    binding: { kind: 'map', layerId: 'indiana-bafm-overlay' }, limitation: 'Planning layer; must remain distinct from FEMA effective products.' },
  { index: 7, id: 'streamstats', title: 'USGS StreamStats peak-flow inputs', authority: 'MODEL_OUTPUT',
    binding: { kind: 'unwired' }, limitation: 'No runtime inundation surface without a bounded, recorded hydrologic analysis.' },
  { index: 8, id: 'parcels', title: 'Indiana reference parcel fabric', authority: 'CONTEXT',
    binding: { kind: 'feature', feature: 'parcels' }, limitation: '2025 public reference footprints are not surveyed property boundaries.' },
  { index: 9, id: 'buildings', title: '3D building/roof representation', authority: 'DERIVED',
    binding: { kind: 'feature', feature: 'buildings' }, limitation: 'New layer shows 2D reference footprints only; LoD2–4 3D geometry is not verified by this binding.' },
  { index: 10, id: 'gauges', title: 'River gauge observation locations', authority: 'OBSERVATION',
    binding: { kind: 'reference-marker' }, limitation: 'Marker location is static; live station readings require separate freshness and datum checks.' },
  { index: 11, id: 'usace-placement', title: 'USACE Section 204 scenarios', authority: 'MODEL_OUTPUT',
    binding: { kind: 'unwired' }, limitation: 'Proposed placement requires project-specific authorization and solver evidence.' },
  { index: 12, id: 'cinematic', title: 'Volumetric mist/cinematic effects', authority: 'PRESENTATION',
    binding: { kind: 'presentation' }, limitation: 'Presentation effect is not a physical observation or engineering result.' },
] as const;

export type PlaneReadiness =
  | 'RENDERER_REGISTERED' | 'REFERENCE_FEATURES_DISPLAYED'
  | 'REFERENCE_LOCATION_ONLY' | 'DERIVED_TILESET_JSON_LOADED' | 'PRESENTATION_ONLY'
  | 'NOT_RENDERED' | 'SOURCE_UNAVAILABLE' | 'MODEL_EVIDENCE_REQUIRED';

export interface PlaneAssessment {
  readonly plane: OpenWorldPlane;
  readonly readiness: PlaneReadiness;
  readonly visible: boolean;
}

export interface PlaneRuntime {
  readonly hasMapLayer: (id: string) => boolean;
  readonly isMapLayerVisible?: (id: string) => boolean;
  readonly terrainEnabled: boolean;
  readonly gaugeMarkerAvailable: boolean;
  readonly featureStates: Partial<Record<IndianaFeatureKind, IndianaFeatureStatus>>;
  readonly presentationEnabled: boolean;
  /** 'ready' means only the tileset JSON loaded; not that meshes were verified or rendered. */
  readonly buildingTiles3DStatus?: 'loading' | 'ready' | 'error' | 'disabled';
}

/** Rendering registration is deliberately not called verification of source data. */
export function inspectOpenWorldPlanes(runtime: PlaneRuntime): readonly PlaneAssessment[] {
  return OPEN_WORLD_PLANES.map(plane => {
    const binding = plane.binding;
    if (binding.kind === 'terrain') {
      return { plane, readiness: runtime.terrainEnabled ? 'RENDERER_REGISTERED' : 'SOURCE_UNAVAILABLE',
        visible: runtime.terrainEnabled } as const;
    }
    if (binding.kind === 'feature') {
      const state = runtime.featureStates[binding.feature] ?? 'DISABLED';
      const isBuilding = binding.feature === 'buildings';
      const buildingTilesetLoaded = isBuilding && runtime.buildingTiles3DStatus === 'ready';
      return { plane, readiness: state === 'DISPLAYED_UNVERIFIED' ? 'REFERENCE_FEATURES_DISPLAYED'
        : buildingTilesetLoaded ? 'DERIVED_TILESET_JSON_LOADED'
          : state === 'SOURCE_UNAVAILABLE' ? 'SOURCE_UNAVAILABLE' : 'NOT_RENDERED',
        visible: state === 'DISPLAYED_UNVERIFIED' || buildingTilesetLoaded } as const;
    }
    if (binding.kind === 'reference-marker') {
      return { plane, readiness: runtime.gaugeMarkerAvailable ? 'REFERENCE_LOCATION_ONLY' : 'NOT_RENDERED',
        visible: runtime.gaugeMarkerAvailable } as const;
    }
    if (binding.kind === 'presentation') {
      return { plane, readiness: 'PRESENTATION_ONLY', visible: runtime.presentationEnabled } as const;
    }
    if (binding.kind === 'model') {
      return { plane, readiness: 'MODEL_EVIDENCE_REQUIRED',
        visible: runtime.isMapLayerVisible?.(binding.layerId) ?? runtime.hasMapLayer(binding.layerId) } as const;
    }
    if (binding.kind === 'map') {
      return { plane, readiness: runtime.hasMapLayer(binding.layerId) ? 'RENDERER_REGISTERED' : 'NOT_RENDERED',
        visible: runtime.isMapLayerVisible?.(binding.layerId) ?? runtime.hasMapLayer(binding.layerId) } as const;
    }
    return { plane, readiness: 'NOT_RENDERED', visible: false } as const;
  });
}
