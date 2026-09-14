export interface EngineeringLayer {
  id: string;
  name: string;
  topFt: number | null;
  bottomFt: number | null;
  materialClass: string | null;
  provenanceId: string;
  publicExplanation: string;
}

export interface EngineeringSectionModel {
  sectionId: string;
  verticalDatum: 'NAVD88';
  horizontalCrs: string;
  reviewState: 'INPUT_INCOMPLETE' | 'MODEL_INPUT' | 'ENGINEERING_REVIEW_READY' | 'ENGINEER_ACCEPTED' | 'AGENCY_ACCEPTED';
  layers: readonly EngineeringLayer[];
  missingEvidence: readonly string[];
}

export default function EngineeringSectionCutaway({ model }: { model: EngineeringSectionModel }): JSX.Element {
  return (
    <section aria-labelledby="engineering-section-title" style={{ background: '#07111c', color: '#f8fafc', border: '1px solid #334155', borderRadius: 18, padding: 20 }}>
      <header>
        <h2 id="engineering-section-title" style={{ margin: 0, fontSize: '1.25rem' }}>Engineering cross-section — ground to finished grade</h2>
        <p style={{ color: '#cbd5e1', marginBottom: 0 }}>Every layer is tied to evidence. Missing field or laboratory evidence remains visible.</p>
      </header>

      <div role="img" aria-label="Vertical engineering cross-section showing soil, foundation preparation, fill, drainage and finished grade" style={{ marginTop: 18, display: 'grid', gap: 6 }}>
        {model.layers.map((layer) => (
          <article key={layer.id} style={{ border: '1px solid #475569', borderRadius: 10, padding: 12, background: '#0f1b27' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>{layer.name}</strong>
              <span style={{ color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
                {layer.topFt === null || layer.bottomFt === null ? 'Elevation pending field control' : `${layer.bottomFt.toFixed(2)}–${layer.topFt.toFixed(2)} ft NAVD88`}
              </span>
            </div>
            <div style={{ color: '#cbd5e1', marginTop: 5 }}>{layer.publicExplanation}</div>
            <small style={{ color: '#94a3b8' }}>Evidence: {layer.provenanceId} · Material: {layer.materialClass ?? 'not qualified'}</small>
          </article>
        ))}
      </div>

      <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: '1px solid #475569' }}>
        <strong>Review state: {model.reviewState}</strong>
        {model.missingEvidence.length > 0 && (
          <ul>
            {model.missingEvidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
