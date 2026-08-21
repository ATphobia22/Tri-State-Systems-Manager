/**
 * Portable metrics card — standard React only (no low-code SDK).
 * Visualization plane helper; not an EvidenceArtifact authority.
 */

import type { CSSProperties } from 'react';

export interface DataMetricsCardProps {
  title: string;
  metricValue: string;
  trendPercentage: number;
  isPositiveTrend: boolean;
  onRefresh?: () => void;
  /** When true, show SIMULATION_DEMO styling cue */
  isSimulationDemo?: boolean;
}

export function DataMetricsCard({
  title,
  metricValue,
  trendPercentage,
  isPositiveTrend,
  onRefresh,
  isSimulationDemo = false,
}: DataMetricsCardProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={labelStyle}>
            {title}
            {isSimulationDemo ? ' · DEMO' : ''}
          </p>
          <h3 style={valueStyle}>{metricValue}</h3>
        </div>
        {onRefresh && (
          <button type="button" onClick={onRefresh} style={btnStyle} aria-label="Refresh metric">
            ↻
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <span
          style={{
            ...badgeStyle,
            background: isPositiveTrend ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
            color: isPositiveTrend ? '#34d399' : '#fb7185',
          }}
        >
          {isPositiveTrend ? '▲' : '▼'} {trendPercentage}%
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>vs prior period</span>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  padding: 20,
  background: '#0f172a',
  borderRadius: 12,
  border: '1px solid #1e293b',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const labelStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const valueStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 28,
  fontWeight: 700,
  color: '#f8fafc',
};

const btnStyle: CSSProperties = {
  padding: 8,
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
};
