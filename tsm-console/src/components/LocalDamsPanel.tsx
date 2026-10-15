import { useEffect, useState } from 'react';
import { loadLocalDamsCatalog, type LocalDamFeature, type LocalDamsCatalog } from '../lib/local-dams';

type Props = {
  onCatalog?: (c: LocalDamsCatalog) => void;
};

/** Scope C — local Posey + Myers L&D inventory panel. */
export default function LocalDamsPanel({ onCatalog }: Props) {
  const [catalog, setCatalog] = useState<LocalDamsCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLocalDamsCatalog()
      .then((c) => {
        setCatalog(c);
        onCatalog?.(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [onCatalog]);

  return (
    <div
      role="region"
      aria-label="Local dams inventory"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #4c1d95',
        background: 'rgba(15,23,42,0.95)',
      }}
    >
      <div style={{ fontWeight: 700, color: '#f8fafc' }}>Local dams (Posey + Myers L&amp;D)</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
        NID-class registry · situational awareness · not a dam-safety determination · no invented pool elevations
      </div>
      {error && (
        <div role="alert" style={{ color: '#fca5a5', marginTop: 6 }}>
          {error}
        </div>
      )}
      {catalog && (
        <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: 11 }}>
          {catalog.features.map((d: LocalDamFeature) => (
            <li
              key={d.id}
              style={{
                padding: '6px 0',
                borderTop: '1px solid #1e293b',
                color: '#e2e8f0',
              }}
            >
              <strong style={{ color: d.hazardPotential === 'High' ? '#fca5a5' : '#e2e8f0' }}>
                {d.name}
              </strong>
              <div style={{ color: '#94a3b8' }}>
                {d.hazardPotential} hazard · {d.condition} · {d.ownerType} · {d.primaryPurpose}
                {d.height_ft != null ? ` · ${d.height_ft} ft` : ''}
                {d.maxStorage_acft != null ? ` · ${d.maxStorage_acft} ac-ft` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
      {catalog && (
        <div style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}>{catalog.disclaimer}</div>
      )}
    </div>
  );
}
