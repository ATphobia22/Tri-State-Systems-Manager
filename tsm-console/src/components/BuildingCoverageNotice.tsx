import { useEffect, useState } from 'react';
import { parsePublishedBuildingCoverage, type BuildingCoverageSummary } from '../lib/building-coverage';

type MissingIdsState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'ready'; ids: number[] };

type NoticeState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'ready'; summary: BuildingCoverageSummary };

/** Visible, source-bound disclosure: never silently promote partial 3D tiles to survey or design data. */
export default function BuildingCoverageNotice() {
  const [state, setState] = useState<NoticeState>({ status: 'loading' });
  const [missingIds, setMissingIds] = useState<MissingIdsState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const url = `${import.meta.env.BASE_URL}3d-tiles/tileset.json`;
    fetch(url, { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('3D Tiles coverage metadata is unavailable');
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const summary = parsePublishedBuildingCoverage(data);
        setState(summary ? { status: 'ready', summary } : { status: 'unavailable' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}3d-tiles/posey-missing-objectids.json`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Missing OBJECTID evidence unavailable');
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (!data || typeof data !== 'object') throw new Error('Invalid missing-ID evidence');
        const report = data as Record<string, unknown>;
        const ids = report.missingObjectIds;
        if (report.schemaVersion !== 'tsm.posey.public-missing-objectids.v1'
          || report.classification !== 'INFORMATIONAL_ONLY'
          || report.engineeringUse !== false || report.regulatoryUse !== false
          || !Array.isArray(ids)
          || !ids.every((id) => Number.isSafeInteger(id) && id > 0)
          || ids.length !== report.missingCount
          || new Set(ids).size !== ids.length
          || !ids.every((id, i) => i === 0 || ids[i - 1] < id)
          || report.sourceFeatureCount !== 23082
          || report.publishedFeatureCount !== 22815) {
          throw new Error('Missing-ID evidence failed integrity checks');
        }
        setMissingIds({ status: 'ready', ids: ids as number[] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMissingIds({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, []);

  let message: string;
  if (state.status === 'ready') {
    const { published, expected, percent, gap, identityReconciled, sourceInventoryVerified } = state.summary;
    message = `Published GeoJSON building-footprint coverage: ${published.toLocaleString()} / ${expected.toLocaleString()} (${percent.toFixed(2)}%); ` +
      (gap > 0 ? `${gap.toLocaleString()} fewer than expected. ` :
        gap < 0 ? `${Math.abs(gap).toLocaleString()} more than expected; investigate. ` : '') +
      (identityReconciled && sourceInventoryVerified
        ? 'Screening identities reported reconciled; mesh coverage and engineering acceptance still unverified.'
        : 'Renderable 3D mesh tiles cover a separate subset; authoritative source validation and engineering acceptance remain open.');
  } else {
    message = state.status === 'loading'
      ? 'Checking 3D building coverage metadata; completeness unverified.'
      : '3D building coverage metadata unavailable; completeness cannot be verified.';
  }

  return (
    <div role="status" aria-live="polite" data-tsm-building-coverage={state.status} style={{
      padding: '0.4rem 1.25rem', fontSize: '0.78rem', lineHeight: 1.5,
      color: '#fcd34d', background: '#1f2937', borderTop: '1px solid #92400e',
    }}>
      {message} Visual screening only — not survey-grade or regulatory evidence.
      {state.status === 'ready' && state.summary.gap > 0 && (
        <details style={{ marginTop: '0.35rem' }}>
          <summary>Inspect missing archived source OBJECTIDs (identity-only evidence)</summary>
          {missingIds.status === 'ready' && missingIds.ids.length === state.summary.gap ? (
            <>
              <p style={{ margin: '0.25rem 0' }}>
                Archived IGIO-labeled snapshot versus published GeoJSON; root causes, source
                vintage, 3D mesh coverage, heights, and NAVD88 provenance remain unverified.
              </p>
              <p style={{ maxHeight: '8rem', overflowY: 'auto', overflowWrap: 'anywhere', margin: '0.25rem 0' }}>
                {missingIds.ids.join(', ')}
              </p>
              <a href={`${import.meta.env.BASE_URL}3d-tiles/posey-missing-objectids.json`}
                download="posey-missing-objectids.json" style={{ color: '#fcd34d', textDecoration: 'underline' }}>
                Download pinned informational OBJECTID set (JSON)
              </a>
            </>
          ) : (
            <p role="alert">
              Missing-ID list {missingIds.status === 'loading' ? 'loading' : 'unavailable or inconsistent'};
              no identities inferred from the count.
            </p>
          )}
        </details>
      )}
    </div>
  );
}
