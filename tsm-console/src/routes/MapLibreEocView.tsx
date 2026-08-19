/**
 * MapLibre EOC surface — patterns adapted from PTDT v35 prototype
 * Visualization Plane only. Stage slider = SIMULATION_DEMO.
 * Seals use real SHA-256 via evidence factory when available.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { SITE } from '../types/site';
import { JURISDICTION_RULES, assessClearanceSupport, type JurisdictionId } from '../lib/jurisdiction-rules';
import { WEB_ENDPOINTS, ENDPOINT_STATUS } from '../lib/web-endpoints';
import { illustrativeHazusLoss } from '../lib/hazus-illustrative';
import { AuthorityBadge, SimulationDemoBanner } from '../components/AuthorityBadge';

export default function MapLibreEocView() {
  const data = useLoaderData() as MapTwinLoaderData;
  const [jurisdiction, setJurisdiction] = useState<JurisdictionId>('INDIANA');
  const [waterStageFt, setWaterStageFt] = useState(SITE.elevations.bfe_ft);
  const [showSources, setShowSources] = useState(false);

  // Live stage if available; slider remains demo control
  const liveStage = data.stage.value_ft;
  const displayStage = liveStage != null ? liveStage : waterStageFt;
  const usingLive = liveStage != null && data.stage.source !== 'MOCK';

  const clearanceFt = useMemo(
    () => parseFloat((SITE.elevations.lag_ft - displayStage).toFixed(2)),
    [displayStage]
  );

  const assessment = useMemo(
    () =>
      assessClearanceSupport({
        jurisdiction,
        waterStageFt: displayStage,
        bfeFt: SITE.elevations.bfe_ft,
        lagFt: SITE.elevations.lag_ft,
      }),
    [jurisdiction, displayStage]
  );

  const hazus = useMemo(
    () => illustrativeHazusLoss(displayStage, SITE.elevations.lag_ft),
    [displayStage]
  );

  const rule = JURISDICTION_RULES[jurisdiction];

  const floodBand = useMemo(() => {
    const above = displayStage - SITE.elevations.bfe_ft;
    if (above > 2.2) return { code: 'CRITICAL', color: '#f87171' };
    if (above > 0) return { code: 'WARNING', color: '#fbbf24' };
    if (above > -2) return { code: 'WATCH', color: '#fde047' };
    return { code: 'CLEAR', color: '#34d399' };
  }, [displayStage]);

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: 1100, margin: '0 auto', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
            EOC Surface — {SITE.address}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            APN {SITE.apn} · EPSG:{SITE.crs.horizontalEpsg} / {SITE.crs.verticalDatum} · MapLibre patterns from PTDT v35
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AuthorityBadge
            authority_class={usingLive ? 'OBSERVATION' : 'SIMULATION_DEMO'}
            is_simulation_demo={!usingLive}
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: floodBand.color }}>
            FLOOD BAND: {floodBand.code}
          </span>
        </div>
      </div>

      {!usingLive && <SimulationDemoBanner />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Stage control */}
        <section style={card}>
          <h2 style={h2}>Hydrologic plane (decision support)</h2>
          <p style={{ fontSize: '0.7rem', color: '#64748b' }}>
            Live: {data.stage.source} {data.stage.gaugeId}{' '}
            {liveStage != null ? `${liveStage} ft` : 'n/a'} · Slider is visualization only
          </p>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Demo stage: {waterStageFt.toFixed(2)} ft NAVD88
            <input
              type="range"
              min={365}
              max={390}
              step={0.05}
              value={waterStageFt}
              onChange={(e) => setWaterStageFt(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: 8 }}
            />
          </label>
          <div style={{ marginTop: 12, fontSize: '0.85rem' }}>
            Display stage: <strong style={{ color: '#38bdf8' }}>{displayStage.toFixed(2)} ft</strong>
            {' · '}
            LAG clearance:{' '}
            <strong style={{ color: clearanceFt >= 0 ? '#34d399' : '#f87171' }}>
              {clearanceFt >= 0 ? '+' : ''}
              {clearanceFt.toFixed(2)} ft
            </strong>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.7rem', color: '#64748b' }}>
            BFE {SITE.elevations.bfe_ft} · LAG {SITE.elevations.lag_ft} · FFE {SITE.elevations.ffe_ft} · Berm{' '}
            {SITE.elevations.bermCrest_ft}
          </div>
        </section>

        {/* Jurisdiction */}
        <section style={card}>
          <h2 style={h2}>Multi-state regulatory citations</h2>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['INDIANA', 'ILLINOIS', 'KENTUCKY'] as JurisdictionId[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setJurisdiction(s)}
                style={{
                  flex: 1,
                  padding: '0.35rem',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  borderRadius: 6,
                  border: jurisdiction === s ? '1px solid #22d3ee' : '1px solid #334155',
                  background: jurisdiction === s ? 'rgba(34,211,238,0.12)' : '#0f172a',
                  color: jurisdiction === s ? '#22d3ee' : '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {s.slice(0, 3)}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>{rule.name}</div>
          <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b' }}>{rule.code}</div>
          <p style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{rule.description}</p>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
            No-rise {rule.no_rise_threshold_ft.toFixed(2)} ft · Comp {rule.compensatory_ratio.toFixed(2)}x ·
            Freeboard {rule.freeboard_req_ft.toFixed(2)} ft
          </div>
          <div
            style={{
              marginTop: 10,
              padding: '0.65rem',
              borderRadius: 8,
              border: '1px solid #334155',
              fontSize: '0.75rem',
              background: assessment.isViolationSupport
                ? 'rgba(248,113,113,0.1)'
                : assessment.isWarningSupport
                  ? 'rgba(251,191,36,0.1)'
                  : 'rgba(52,211,153,0.08)',
            }}
          >
            <div style={{ fontWeight: 700 }}>{assessment.code}</div>
            <div>{assessment.finding}</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: '0.65rem' }}>{assessment.note}</div>
          </div>
        </section>

        {/* Illustrative HAZUS */}
        <section style={card}>
          <h2 style={h2}>
            Illustrative loss curves <AuthorityBadge authority_class="SIMULATION_DEMO" is_simulation_demo size="sm" />
          </h2>
          <p style={{ fontSize: '0.65rem', color: '#f87171' }}>{hazus.disclaimer}</p>
          <div style={{ fontSize: '0.8rem', display: 'grid', gap: 4 }}>
            <div>Depth at structure: {hazus.depthFt.toFixed(2)} ft</div>
            <div>Structural (illustrative): ${hazus.buildingLossUsd.toFixed(0)}</div>
            <div>Contents (illustrative): ${hazus.contentLossUsd.toFixed(0)}</div>
            <div style={{ fontWeight: 700 }}>Total (illustrative): ${hazus.totalLossUsd.toFixed(0)}</div>
          </div>
          <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 8 }}>
            Model: {hazus.model_name} · {hazus.model_version}
          </p>
        </section>

        {/* Endpoints */}
        <section style={card}>
          <h2 style={h2}>
            Authority endpoints{' '}
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              style={{ fontSize: '0.65rem', marginLeft: 8, cursor: 'pointer' }}
            >
              {showSources ? 'hide' : 'show'}
            </button>
          </h2>
          {showSources && (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.7rem', fontFamily: 'monospace' }}>
              {(Object.keys(WEB_ENDPOINTS) as (keyof typeof WEB_ENDPOINTS)[]).map((k) => (
                <li key={k} style={{ marginBottom: 4 }}>
                  <span style={{ color: ENDPOINT_STATUS[k] === 'VERIFIED' ? '#34d399' : '#fbbf24' }}>
                    [{ENDPOINT_STATUS[k]}]
                  </span>{' '}
                  {k}: {WEB_ENDPOINTS[k].slice(0, 60)}…
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: '0.65rem', color: '#64748b' }}>
            XSoft / elevation.gio marked PROVISIONAL until endpoint validation (Authority Registry v35).
          </p>
        </section>
      </div>

      <p style={{ marginTop: 16, fontSize: '0.65rem', color: '#475569', textAlign: 'center' }}>
        BCA ratio 2.45 from prototype is not adopted as authoritative without provenance. MapLibre 3D mesh /
        cinematic camera can be added as optional layers — always tagged VISUALIZATION / SIMULATION_DEMO.
      </p>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: 12,
  padding: '1rem',
  border: '1px solid #334155',
};

const h2: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.8rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
