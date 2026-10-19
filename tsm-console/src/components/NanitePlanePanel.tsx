import { useCallback, useState } from 'react';
import { t } from '../lib/design-tokens';
import {
  isNanitePlaneEnabled,
  runNanitePlaneSmoke,
  type NanitePlaneStatus,
} from '../lib/webgpu-nanite';

/**
 * Optional WebGPU Nanite plane B panel. Hidden when flag off.
 * Regulatory map remains MapLibre — this is SIMULATION_DEMO only.
 */
export function NanitePlanePanel(props: {
  centerLng: number;
  centerLat: number;
}) {
  const enabled = isNanitePlaneEnabled();
  const [status, setStatus] = useState<NanitePlaneStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const runSmoke = useCallback(async () => {
    setBusy(true);
    try {
      const result = await runNanitePlaneSmoke({
        camera: {
          centerLng: props.centerLng,
          centerLat: props.centerLat,
          zoom: 14,
          bearing: 0,
          pitch: 45,
          widthPx: 800,
          heightPx: 600,
        },
      });
      setStatus(result);
    } finally {
      setBusy(false);
    }
  }, [props.centerLat, props.centerLng]);

  if (!enabled) {
    return (
      <div
        style={{
          background: t.color.surface.base,
          borderRadius: t.radius.lg,
          padding: '1rem',
          border: `1px solid ${t.color.surface.card}`,
          marginTop: 12,
        }}
      >
        <h3 style={{ color: t.color.text.secondary, margin: '0 0 0.35rem', fontSize: t.font.size.base }}>
          WebGPU Nanite plane
        </h3>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: 0 }}>
          Disabled. Set <code>VITE_TSM_WEBGPU_NANITE=1</code> to probe Hierarchical-Z / meshlet plane B
          (SIMULATION_DEMO — not regulatory).
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: t.color.surface.card,
        borderRadius: t.radius.lg,
        padding: '1rem',
        marginTop: 12,
        border: `1px solid ${t.color.status.info}`,
      }}
    >
      <h3 style={{ color: t.color.status.info, margin: '0 0 0.5rem', fontSize: t.font.size.xl }}>
        WebGPU Nanite plane (SIMULATION_DEMO)
      </h3>
      <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: '0 0 0.75rem' }}>
        Plane B: depth pyramid / future meshlets. MapLibre remains the authority for NFHL and gauges.
      </p>
      <button
        type="button"
        onClick={runSmoke}
        disabled={busy}
        aria-label="Probe WebGPU Nanite plane"
        style={{
          padding: '0.5rem 1rem',
          borderRadius: t.radius.md,
          border: 'none',
          background: t.color.accent.brand,
          color: '#fff',
          fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Probing…' : 'Probe WebGPU plane'}
      </button>
      {status && (
        <pre
          style={{
            marginTop: '0.75rem',
            fontSize: t.font.size.sm,
            color: t.color.text.body,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(status, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default NanitePlanePanel;
