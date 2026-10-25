import { useEffect, useState } from 'react';
import { parsePublishedBuildingCoverage, type BuildingCoverageSummary } from '../lib/building-coverage';

type NoticeState =
  | { status: 'loading' | 'unavailable' }
  | { status: 'ready'; summary: BuildingCoverageSummary };

/** Visible, source-bound disclosure: never silently promote partial 3D tiles to survey or design data. */
export default function BuildingCoverageNotice() {
  const [state, setState] = useState<NoticeState>({ status: 'loading' });

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

  let message: string;
  if (state.status === 'ready') {
    const { published, expected, percent, gap, identityReconciled, sourceInventoryVerified } = state.summary;
    message = `Building 3D coverage: ${published.toLocaleString()} / ${expected.toLocaleString()} (${percent.toFixed(2)}%); ` +
      (gap > 0 ? `${gap.toLocaleString()} fewer than expected. ` :
        gap < 0 ? `${Math.abs(gap).toLocaleString()} more than expected; investigate. ` : '') +
      (identityReconciled && sourceInventoryVerified
        ? 'Source IDs reported reconciled; engineering acceptance still unverified.'
        : 'Missing source identities not yet verified; independent source comparison required.');
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
    </div>
  );
}
