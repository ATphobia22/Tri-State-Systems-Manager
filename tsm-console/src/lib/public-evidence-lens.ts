/** Accessible, informational uncertainty lens for the existing map scene.
 *
 * These statuses are about evidence availability/review, NOT flood risk,
 * measurement precision, forecast skill or regulatory approval.
 * No network requests or additional data sources are triggered by this module.
 */
import type { MapTwinLoaderData } from '../types/loaders';
import type { GovernmentSceneDetail } from './government-pmtiles-overlay';

export type SceneEvidenceState =
  | 'SOURCE_UNAVAILABLE'
  | 'STALE_OBSERVATION'
  | 'OBSERVATION_TIME_UNKNOWN'
  | 'UNRESOLVED_DATUM'
  | 'VALUE_UNREVIEWED'
  | 'DERIVED_VISUAL_ONLY'
  | 'HISTORICAL_SNAPSHOT';

export type SceneEvidenceItem = {
  key: 'gage' | 'water-surface' | 'government-snapshot' | '3d-tiles';
  label: string;
  state: SceneEvidenceState;
  detail: string;
};

export type TileVisibility = {
  enabled: boolean;
  status: 'loading' | 'ready' | 'error' | 'disabled';
};

export function deriveSceneEvidenceLens(
  stage: MapTwinLoaderData['stage'],
  government: GovernmentSceneDetail,
  tiles: TileVisibility,
): SceneEvidenceItem[] {
  const gage: SceneEvidenceItem = {
    key: 'gage',
    label: 'River gage observation',
    state: 'SOURCE_UNAVAILABLE',
    detail: 'No eligible observation is available; missing stage is not zero.',
  };
  if (stage.source !== 'UNAVAILABLE' && stage.value_ft !== null
      && Number.isFinite(stage.value_ft)) {
    if (stage.status === 'stale') {
      gage.state = 'STALE_OBSERVATION';
      gage.detail = 'The source explicitly labels this observation stale; it is not a live reading.';
    } else if (stage.timestamp === null || !Number.isFinite(Date.parse(stage.timestamp))) {
      gage.state = 'OBSERVATION_TIME_UNKNOWN';
      gage.detail = 'A number exists but its observation time is not established.';
    } else {
      gage.state = 'VALUE_UNREVIEWED';
      gage.detail = 'A source-labeled gage observation is shown; independent spatial/temporal review and source-byte verification are separate.';
    }
  }

  const vertical: SceneEvidenceItem = {
    key: 'water-surface',
    label: 'NAVD88 water-surface elevation',
    state: 'UNRESOLVED_DATUM',
    detail: 'No site-authorized vertical conversion is established. Gage stage is not NAVD88 elevation.',
  };
  if (stage.wse_navd88_ft !== null && Number.isFinite(stage.wse_navd88_ft)
      && stage.conversion_applied && stage.gage_zero_navd88_ft !== null
      && Number.isFinite(stage.gage_zero_navd88_ft)) {
    vertical.state = 'VALUE_UNREVIEWED';
    vertical.detail = 'A gage-zero conversion is reported. The transformation, station identity, site transfer and control-point evidence still require independent review.';
  }

  const snapshot: SceneEvidenceItem = {
    key: 'government-snapshot',
    label: 'Government geospatial archive',
    state: 'SOURCE_UNAVAILABLE',
    detail: 'The government archive is not available for this scene. Other layers can remain usable.',
  };
  if (government.status === 'HISTORICAL_GOVERNMENT_FALLBACK') {
    snapshot.state = 'HISTORICAL_SNAPSHOT';
    snapshot.detail = 'A historical archive is displayed, not current source conditions or regulatory approval.';
  } else if (government.status === 'CURRENT_GOVERNMENT_SNAPSHOT') {
    snapshot.state = government.archiveBytesVerified ? 'VALUE_UNREVIEWED' : 'SOURCE_UNAVAILABLE';
    snapshot.detail = government.archiveBytesVerified
      ? 'The archive digest was checked. Independent source-byte verification, currentness, engineering applicability and regulatory approval are not established.'
      : 'The archive is advertised as dated, but archive bytes have not been verified.';
  }
  if (government.sourceBytesIndependentlyVerified) {
    // A verified source-byte flag still does not authorize interpretation or a
    // regulatory claim. Keep the same conservative state.
    snapshot.detail += ' Independent source bytes were checked, not parcel-level conclusions.';
  }

  const visual: SceneEvidenceItem = {
    key: '3d-tiles',
    label: '3D terrain and tiles',
    state: 'SOURCE_UNAVAILABLE',
    detail: 'The render layer is disabled, unavailable or not ready; it cannot support a geometry claim.',
  };
  if (tiles.enabled && tiles.status === 'ready') {
    visual.state = 'DERIVED_VISUAL_ONLY';
    visual.detail = '3D content is rendered. Screen appearance does not establish terrain accuracy, surveyed LOD, datum correctness or engineering approval.';
  } else if (tiles.enabled && tiles.status === 'loading') {
    visual.detail = '3D visualization is loading; no rendering or geometry acceptance is claimed.';
  } else if (tiles.enabled && tiles.status === 'error') {
    visual.detail = '3D rendering failed; map and source-evidence panels may still function.';
  }

  return [gage, vertical, snapshot, visual];
}

export function summarizeSceneEvidence(items: readonly SceneEvidenceItem[]) {
  return {
    total: items.length,
    missing: items.filter(item => item.state === 'SOURCE_UNAVAILABLE').length,
    unresolved: items.filter(item => item.state === 'UNRESOLVED_DATUM' || item.state === 'OBSERVATION_TIME_UNKNOWN').length,
    stale: items.filter(item => item.state === 'STALE_OBSERVATION' || item.state === 'HISTORICAL_SNAPSHOT').length,
    derivedVisualOnly: items.filter(item => item.state === 'DERIVED_VISUAL_ONLY').length,
    independentlyCertified: 0 as const,
  };
}
