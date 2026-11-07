/**
 * Hard UI gate: raw EPQS / DEM samples must not be evaluated as LOMA eligibility vs BFE.
 * Statistical bands (1.96×RMSE or semivariogram) ≠ certified elevation.
 */
import { useEffect, useId } from 'react';

export interface EpqsBfeWarningModalProps {
  open: boolean;
  onClose: () => void;
  epqsValue?: number | null;
  epqsUnits?: 'ft' | 'm';
  bfeValue?: number | null;
  bfeUnits?: 'ft' | 'm';
}

const RMSE_DYNAMIC_M = 0.53;
const NSSDA_95_M = 1.96 * RMSE_DYNAMIC_M;

export function EpqsBfeWarningModal({
  open,
  onClose,
  epqsValue,
  epqsUnits = 'ft',
  bfeValue,
  bfeUnits = 'ft',
}: EpqsBfeWarningModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: '#fff',
          color: '#111',
          borderRadius: 8,
          padding: '20px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 id={titleId} style={{ margin: '0 0 12px', fontSize: 18 }}>
          EPQS / DEM cannot clear LOMA vs BFE
        </h2>
        <p style={{ margin: '0 0 10px', lineHeight: 1.45, fontSize: 14 }}>
          You attempted to compare a raw USGS EPQS (or DEM) elevation to an active Base Flood
          Elevation. That comparison is <strong>not</strong> a Letter of Map Amendment determination.
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13, lineHeight: 1.45 }}>
          <li>
            3DEP dynamic / EPQS network RMSE ≈ {RMSE_DYNAMIC_M} m; NSSDA-style 1.96×RMSE ≈{' '}
            {NSSDA_95_M.toFixed(2)} m is a <em>dataset reporting</em> statistic, not a certified lot-corner
            elevation.
          </li>
          <li>Semivariogram uncertainty surfaces are DERIVED visualization only.</li>
          <li>
            LOMA requires recorded deed/plat, assessor map tied to the FIRM, and elevations certified by
            a licensed surveyor or PE on the map datum (typically NAVD88).
          </li>
          <li>Human authority remains final — TSM does not issue LOMA outcomes.</li>
        </ul>
        {(epqsValue != null || bfeValue != null) && (
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#444' }}>
            Context only
            {epqsValue != null && (
              <>
                : EPQS {epqsValue} {epqsUnits}
              </>
            )}
            {bfeValue != null && (
              <>
                {epqsValue != null ? ' \u00b7 ' : ': '}
                BFE {bfeValue} {bfeUnits}
              </>
            )}
            . Do not treat difference as eligibility.
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 4,
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #333',
            background: '#1a1a1a',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Acknowledge — continue without LOMA claim
        </button>
      </div>
    </div>
  );
}

export function shouldBlockEpqsBfeEligibilityCompare(args: {
  sourceAuthority: string;
  intent: 'eligibility' | 'screening' | 'display';
}): boolean {
  if (args.intent !== 'eligibility') return false;
  const a = args.sourceAuthority.toUpperCase();
  return a.includes('EPQS') || a.includes('3DEP') || a.includes('DEM') || a === 'DERIVED';
}
