/**
 * Opt-in session live shadow toggle (default OFF).
 * Not continuous live 4D product claim.
 */
import type { LiveShadowStatus } from '../lib/session-live-shadow';
import {
  LIVE_SHADOW_MAX_SESSION_MS,
  LIVE_SHADOW_POLL_MS,
  LIVE_SHADOW_STALE_MS,
} from '../lib/session-live-shadow';

type Props = {
  status: LiveShadowStatus;
  onToggle: (enable: boolean) => void;
};

function fmtAge(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function LiveShadowPanel({ status, onToggle }: Props): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label="Session live shadow"
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #1e3a5f',
        background: 'rgba(15,23,42,0.9)',
      }}
    >
      <strong style={{ color: '#38bdf8' }}>Session live shadow</strong>
      <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
        Opt-in only · poll every {LIVE_SHADOW_POLL_MS / 1000}s · stale after {LIVE_SHADOW_STALE_MS / 60000} min ·
        auto-stop {LIVE_SHADOW_MAX_SESSION_MS / 60000} min · default remains button-only · not continuous live 4D
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-pressed={status.enabled}
          onClick={() => onToggle(!status.enabled)}
          style={{
            minHeight: 44,
            padding: '0.5rem 0.9rem',
            borderRadius: 8,
            border: status.enabled ? '1px solid #0369a1' : '1px solid #1e293b',
            background: status.enabled ? 'rgba(56,189,248,0.2)' : '#020617',
            color: status.enabled ? '#38bdf8' : '#94a3b8',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {status.enabled ? 'Shadow ON (stop)' : 'Enable session shadow'}
        </button>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: status.stale ? '#fbbf24' : '#64748b' }}>
        Age: {fmtAge(status.ageMs)}
        {status.stale ? ' · STALE — re-fetch or stop' : ''}
        {status.ticks > 0 ? ` · ticks ${status.ticks}` : ''}
      </div>
      {status.error && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#f87171' }}>{status.error}</div>
      )}
      {status.autoStoppedReason && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#fbbf24' }}>
          Auto-stopped: {status.autoStoppedReason}
        </div>
      )}
    </div>
  );
}
