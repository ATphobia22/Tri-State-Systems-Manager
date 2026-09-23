import type { CSSProperties } from 'react';
import { auditFemaLomaEvidence, type LomaEvidenceInput } from '../lib/fema-loma-evidence';

export interface FemaLomaFormPanelV3Props {
  evidence: LomaEvidenceInput;
  bfeFt?: number;
  lagFt?: number;
}

const card: CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 10,
  padding: 16,
  background: '#0f172a',
  color: '#e2e8f0',
};

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

/**
 * FEMA LOMA pre-screening panel.
 *
 * This is a document/evidence readiness surface, not a FEMA form replica and
 * not a certification workflow. It intentionally cannot sign, seal, submit,
 * or issue a regulatory determination.
 */
export function FemaLomaFormPanelV3({
  evidence,
  bfeFt,
  lagFt,
}: FemaLomaFormPanelV3Props) {
  const audit = auditFemaLomaEvidence(evidence);
  const freeboardFt =
    bfeFt !== undefined && lagFt !== undefined ? lagFt - bfeFt : undefined;

  return (
    <section aria-labelledby="fema-loma-title" style={{ display: 'grid', gap: 12 }}>
      <div style={card}>
        <h2 id="fema-loma-title" style={{ marginTop: 0 }}>
          FEMA LOMA Pre-Screening
        </h2>
        <p>
          Evidence-readiness only. TSM does not certify elevations, sign forms,
          issue LOMA/LOMR decisions, or replace FEMA, IDNR, local officials,
          surveyors, engineers, or other authorized reviewers.
        </p>
        <strong aria-live="polite">
          Submission state: {statusLabel(audit.submissionStatus)}
        </strong>
      </div>

      {freeboardFt !== undefined && (
        <div role="note" style={card}>
          <strong>Analytical elevation comparison</strong>
          <div>
            LAG − BFE = {freeboardFt >= 0 ? '+' : ''}{freeboardFt.toFixed(2)} ft
          </div>
          <small>
            This is a mathematical comparison only. It is not a FEMA
            determination, professional certification, or proof of regulatory
            compliance.
          </small>
        </div>
      )}

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Evidence gates</h3>
        <ul>
          {audit.gates.map((gate) => (
            <li key={gate.id} style={{ marginBottom: 10 }}>
              <strong>{gate.label}: </strong>
              <span>{statusLabel(gate.status)}</span>
              <div>{gate.reason}</div>
            </li>
          ))}
        </ul>
      </div>

      {audit.missingRequired.length > 0 && (
        <div role="alert" style={card}>
          <h3 style={{ marginTop: 0 }}>Blocked — missing or unresolved evidence</h3>
          <ul>
            {audit.missingRequired.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      )}

      {audit.humanCertificationRequired && (
        <div role="note" style={card}>
          <h3 style={{ marginTop: 0 }}>Human certification required</h3>
          <p>
            TSM can validate presence and metadata. It cannot manufacture a
            professional signature, license, seal, survey, or elevation
            certification.
          </p>
        </div>
      )}
    </section>
  );
}

export default FemaLomaFormPanelV3;
