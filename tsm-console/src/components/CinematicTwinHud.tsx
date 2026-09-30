import { useState } from 'react';
import EngineeringSectionCutaway, {
  type EngineeringSectionModel,
} from './EngineeringSectionCutaway';

/**
 * CinematicTwinHud — collapsible cinematic HUD overlay for the 3D digital twin.
 *
 * Ported UI patterns from TSMOpenWorldTwinView-v2.tsx (React Native) and
 * TSMAppleMapsDigitalTwinView.swift (SwiftUI/MapKit) into the web console's
 * React + MapLibre format:
 *  - floating top HUD bar with title, datum line, and layer chips
 *  - collapsible bottom drawer with ENGINEERING / DATA FABRIC / TWIN ENV tabs
 *  - berm / road placement mode buttons
 *  - hydraulic cutaway trigger opening the evidence-bound EngineeringSectionCutaway
 *
 * Deliberate divergences from the uploads: no live gauge readings (telemetry is
 * retired), no "ray tracing" toggle, no invented BFE/fill numbers. Every number
 * shown comes from the FEMA case record or is labeled as user input.
 */

export type TwinLayerId =
  | 'fema-bfe'
  | 'buildings'
  | 'roads'
  | 'quad-index'
  | 'imagery';

export type EngineeringMode = 'NAVIGATION' | 'BERM_PLACEMENT' | 'ROAD_CONSTRUCTION';

export interface CinematicTwinHudProps {
  layers: Record<TwinLayerId, boolean>;
  onToggleLayer: (id: TwinLayerId) => void;
  engineeringMode: EngineeringMode;
  onEngineeringModeChange: (mode: EngineeringMode) => void;
  /** Presentation lighting preset; visual only, never analytical. */
  lightPreset: 'day' | 'golden' | 'night';
  onLightPresetChange: (p: 'day' | 'golden' | 'night') => void;
  cutawayModel: EngineeringSectionModel;
}

const LAYER_LABELS: Record<TwinLayerId, string> = {
  'fema-bfe': 'FEMA BFE',
  buildings: 'Buildings',
  roads: 'Roads',
  'quad-index': 'Quad index',
  imagery: 'Imagery',
};

function Chip({
  label,
  active,
  onClick,
  color = '#0284c7',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: '6px 12px',
        borderRadius: 16,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.25)'}`,
        background: active ? color : 'rgba(0,0,0,0.55)',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export default function CinematicTwinHud(props: CinematicTwinHudProps) {
  const { layers, onToggleLayer, engineeringMode, onEngineeringModeChange } = props;
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [tab, setTab] = useState<'ENGINEERING' | 'DATA FABRIC' | 'TWIN ENV'>('ENGINEERING');
  const [cutawayOpen, setCutawayOpen] = useState(false);

  return (
    <>
      {/* ===== Top HUD bar ===== */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          right: 12,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(15,23,42,0.82)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 14,
            padding: 10,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  color: '#22d3ee',
                }}
              >
                OHIO–WABASH CONFLUENCE
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                3D Digital Twin
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                EPSG:2966 · NAVD88 · FEMA case 26-05-2022A · BFE 375.0 ft
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHudCollapsed((c) => !c)}
              style={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 10,
                fontWeight: 800,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              {hudCollapsed ? '▼ SHOW UI' : '▲ CINEMATIC'}
            </button>
          </div>
          {!hudCollapsed && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(Object.keys(LAYER_LABELS) as TwinLayerId[]).map((id) => (
                <Chip
                  key={id}
                  label={LAYER_LABELS[id]}
                  active={layers[id]}
                  onClick={() => onToggleLayer(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== Bottom drawer ===== */}
      {!hudCollapsed && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: '46%',
            overflowY: 'auto',
            background: 'rgba(15,23,42,0.92)',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: '8px 16px 20px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: 8,
              marginBottom: 10,
            }}
          >
            {(['ENGINEERING', 'DATA FABRIC', 'TWIN ENV'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: tab === t ? '#0284c7' : 'transparent',
                  color: '#f8fafc',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'ENGINEERING' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 8 }}>
                Berm &amp; road placement
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(
                  [
                    ['ROAD_CONSTRUCTION', 'ROAD CONNECT'],
                    ['BERM_PLACEMENT', 'BERM PLACE'],
                    ['NAVIGATION', 'NAVIGATE'],
                  ] as [EngineeringMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onEngineeringModeChange(mode)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: `1px solid ${engineeringMode === mode ? '#38bdf8' : '#334155'}`,
                      background: engineeringMode === mode ? '#0284c7' : '#1e293b',
                      color: '#f8fafc',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCutawayOpen(true)}
                style={{
                  width: '100%',
                  background: '#0f766e',
                  border: '1px solid #14b8a6',
                  borderRadius: 10,
                  padding: 10,
                  color: '#ccfbf1',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                OPEN HYDRAULIC SECTION CUTAWAY
                <div style={{ fontSize: 9, fontWeight: 400, color: '#99f6e4', marginTop: 2 }}>
                  Evidence-bound section — missing field data stays visible
                </div>
              </button>
              <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
                Placement tools draw proposed geometry only. No stability or
                seepage values are computed here — those require licensed
                engineering analysis.
              </p>
            </div>
          )}

          {tab === 'DATA FABRIC' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 8 }}>
                Mapping fabrics
              </div>
              {(Object.keys(LAYER_LABELS) as TwinLayerId[]).map((id) => (
                <label
                  key={id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    color: '#e2e8f0',
                    fontSize: 12,
                  }}
                >
                  {LAYER_LABELS[id]}
                  <input
                    type="checkbox"
                    checked={layers[id]}
                    onChange={() => onToggleLayer(id)}
                    style={{ width: 18, height: 18 }}
                  />
                </label>
              ))}
              <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
                Live river telemetry is retired. Layers show the newest verified
                government snapshots, never live readings.
              </p>
            </div>
          )}

          {tab === 'TWIN ENV' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#38bdf8', marginBottom: 8 }}>
                Presentation lighting <span style={{ fontWeight: 400, color: '#94a3b8' }}>(visual only)</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['day', 'golden', 'night'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => props.onLightPresetChange(p)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: `1px solid ${props.lightPreset === p ? '#38bdf8' : '#334155'}`,
                      background: props.lightPreset === p ? '#0284c7' : '#1e293b',
                      color: '#f8fafc',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
                Lighting presets change the scene's look only. They carry no
                meteorological or hydraulic meaning.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== Cutaway modal (honest, evidence-bound) ===== */}
      {cutawayOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hydraulic section cutaway"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setCutawayOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '88vh',
              overflowY: 'auto',
              background: '#0f172a',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTop: '1px solid #334155',
              padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ color: '#f8fafc' }}>Hydraulic section cutaway</strong>
              <button
                type="button"
                onClick={() => setCutawayOpen(false)}
                style={{
                  background: '#334155',
                  border: 'none',
                  borderRadius: 8,
                  color: '#f1f5f9',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                ✕ CLOSE
              </button>
            </div>
            <EngineeringSectionCutaway model={props.cutawayModel} />
          </div>
        </div>
      )}
    </>
  );
}
