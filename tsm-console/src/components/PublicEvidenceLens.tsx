import type { MapTwinLoaderData } from '../types/loaders';
import type { GovernmentSceneDetail } from '../lib/government-pmtiles-overlay';
import { deriveSceneEvidenceLens, summarizeSceneEvidence, type TileVisibility } from '../lib/public-evidence-lens';

/** Optional accessible legend. Never claims missing measurements are zero. */
export default function PublicEvidenceLens({
  stage, government, tiles,
}: {
  stage: MapTwinLoaderData['stage'];
  government: GovernmentSceneDetail;
  tiles: TileVisibility;
}) {
  const items = deriveSceneEvidenceLens(stage, government, tiles);
  const summary = summarizeSceneEvidence(items);
  return (
    <section
      aria-label="Evidence uncertainty lens"
      style={{
        marginTop: 10, padding: 12, borderRadius: 10,
        background: 'rgba(15,23,42,.98)', border: '1px solid rgba(148,163,184,.45)',
      }}
    >
      <strong style={{ fontSize: 14, color: '#e2e8f0' }}>Evidence lens — what the scene does not prove</strong>
      <p style={{ margin: '6px 0', color: '#cbd5e1' }}>
        {summary.missing} unavailable, {summary.unresolved} unresolved, {summary.stale} stale or historical,
        {' '}{summary.derivedVisualOnly} visualization-only layers. Independent certifications: none established here.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li key={item.key} style={{ padding: '8px 0', borderTop: '1px solid rgba(148,163,184,.25)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong>{item.label}</strong>
              <span style={{
                border: '1px solid rgba(251,191,36,.6)', borderRadius: 5,
                padding: '1px 5px', color: '#fcd34d', fontSize: 11,
              }}>{item.state.replaceAll('_', ' ')}</span>
            </div>
            <div style={{ marginTop: 3, color: '#cbd5e1' }}>{item.detail}</div>
          </li>
        ))}
      </ul>
      <p role="note" style={{ color: '#fbbf24', marginBottom: 0 }}>
        SOURCE / DERIVED / MODELED / FORECAST / UNAVAILABLE are provenance states, not flood-risk predictions.
        No scene rendering or hashed archive constitutes FEMA approval, a survey, or a safe/unsafe determination.
      </p>
    </section>
  );
}
