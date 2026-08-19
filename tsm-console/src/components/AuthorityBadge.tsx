/**
 * UI badges for authority_class and is_simulation_demo
 * Public Experience Plane — provenance visible in the UI
 */

import type { AuthorityClass } from '../types/evidence';

const COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  OBSERVATION: { bg: 'rgba(52,211,153,0.15)', fg: '#34d399', label: 'OBSERVATION' },
  FORECAST: { bg: 'rgba(56,189,248,0.15)', fg: '#38bdf8', label: 'FORECAST' },
  REGULATORY: { bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa', label: 'REGULATORY' },
  DERIVED: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8', label: 'DERIVED' },
  MODEL_OUTPUT: { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24', label: 'MODEL' },
  INFERENCE: { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c', label: 'INFERENCE' },
  VISUALIZATION: { bg: 'rgba(100,116,139,0.2)', fg: '#64748b', label: 'VISUALIZATION' },
  SIMULATION_DEMO: { bg: 'rgba(248,113,113,0.2)', fg: '#f87171', label: 'SIMULATION / DEMO' },
};

export function AuthorityBadge({
  authority_class,
  is_simulation_demo,
  size = 'sm',
}: {
  authority_class: AuthorityClass | string;
  is_simulation_demo?: boolean;
  size?: 'sm' | 'md';
}) {
  const key = is_simulation_demo ? 'SIMULATION_DEMO' : authority_class;
  const c = COLORS[key] || COLORS.DERIVED;
  const pad = size === 'md' ? '0.25rem 0.6rem' : '0.15rem 0.45rem';
  const fs = size === 'md' ? '0.7rem' : '0.6rem';

  return (
    <span
      title={
        is_simulation_demo || authority_class === 'SIMULATION_DEMO'
          ? 'SIMULATION / DEMO DATA — not live telemetry, not an engineering prediction, not a regulatory determination.'
          : `authority_class: ${authority_class}`
      }
      style={{
        display: 'inline-block',
        padding: pad,
        borderRadius: 6,
        background: c.bg,
        color: c.fg,
        fontSize: fs,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        border: `1px solid ${c.fg}33`,
      }}
    >
      {c.label}
    </span>
  );
}

export function SimulationDemoBanner() {
  return (
    <div
      style={{
        background: 'rgba(248,113,113,0.1)',
        border: '1px solid rgba(248,113,113,0.35)',
        borderRadius: 10,
        padding: '0.65rem 1rem',
        fontSize: '0.8rem',
        color: '#fca5a5',
        marginBottom: '1rem',
      }}
    >
      <strong>SIMULATION / DEMO DATA</strong> — Not live telemetry. Not an engineering prediction.
      Not a regulatory determination. Human authority remains final.
    </div>
  );
}
