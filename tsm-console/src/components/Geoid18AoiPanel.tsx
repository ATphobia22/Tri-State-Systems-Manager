import { useEffect, useState } from 'react';
import {
  convertWithAoiN,
  loadPoseyGeoid18Aoi,
  type ConversionResult,
  type Geoid18AoiCatalog,
} from '../lib/geodetic/posey-geoid18-aoi';


/**
 * Educational GEOID18 conversion playground (Scope B).
 * Static AOI samples only. AuthorityClass DERIVED. Not OPUS / not survey.
 */
export default function Geoid18AoiPanel() {
  const [catalog, setCatalog] = useState<Geoid18AoiCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'h_to_H' | 'H_to_h'>('h_to_H');
  const [valueM, setValueM] = useState('100');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);

  useEffect(() => {
    loadPoseyGeoid18Aoi()
      .then(setCatalog)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const run = (): void => {
    if (!catalog) return;
    if (!lat.trim() || !lon.trim()) {
      setResult({ ok: false, reason: 'Select a public regional sample or enter valid coordinates.' });
      return;
    }
    const v = Number(valueM);
    const la = Number(lat);
    const lo = Number(lon);
    setResult(convertWithAoiN(catalog, { mode, value_m: v, lat: la, lon: lo }));
  };

  return (
    <div
      role="region"
      aria-label="GEOID18 educational converter"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #475569',
        background: 'rgba(15,23,42,0.95)',
      }}
    >
      <div style={{ fontWeight: 700, color: '#f8fafc' }}>GEOID18 playground (educational)</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
        H = h − N · model GEOID18 · CONUS fit σ ≈ 1.27 cm (fit to GPS-on-BM, not absolute accuracy).
        DERIVED only · not OPUS · not LOMA input · conversion is only allowed at an explicitly recorded sample (within 2 m), not interpolated across the county.
      </div>
      {error && <div role="alert" style={{ color: '#fca5a5' }}>{error}</div>}
      {catalog && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
              Public regional sample
              <select
                defaultValue=""
                onChange={(event) => {
                  const selected = catalog.points.find((point) => point.id === event.target.value);
                  setLat(selected ? String(selected.lat) : '');
                  setLon(selected ? String(selected.lon) : '');
                  setResult(null);
                }}
                style={{ minHeight: 36, background: '#020617', color: '#e2e8f0', border: '1px solid #334155' }}
              >
                <option value="">Choose a sample</option>
                {catalog.points.map((point) => <option key={point.id} value={point.id}>{point.id}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
              Mode
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'h_to_H' | 'H_to_h')}
                style={{ minHeight: 36, background: '#020617', color: '#e2e8f0', border: '1px solid #334155' }}
              >
                <option value="h_to_H">Ellipsoid h → Orthometric H</option>
                <option value="H_to_h">Orthometric H → Ellipsoid h</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
              Height (m)
              <input
                value={valueM}
                onChange={(e) => setValueM(e.target.value)}
                inputMode="decimal"
                style={{ minHeight: 36, width: 100, background: '#020617', color: '#e2e8f0', border: '1px solid #334155' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
              Lat
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                inputMode="decimal"
                style={{ minHeight: 36, width: 110, background: '#020617', color: '#e2e8f0', border: '1px solid #334155' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
              Lon
              <input
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                inputMode="decimal"
                style={{ minHeight: 36, width: 110, background: '#020617', color: '#e2e8f0', border: '1px solid #334155' }}
              />
            </label>
            <button
              type="button"
              onClick={run}
              style={{
                alignSelf: 'end',
                minHeight: 36,
                padding: '0 12px',
                borderRadius: 6,
                border: '1px solid #64748b',
                background: '#1e293b',
                color: '#e2e8f0',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Convert
            </button>
          </div>
          {result && result.ok && (
            <div style={{ marginTop: 8, color: '#bbf7d0', fontSize: 12 }}>
              N = {result.N_m.toFixed(3)} m ({result.point.id}) → output{' '}
              <strong>{result.output_m.toFixed(3)} m</strong> ({result.output_ft.toFixed(2)} ft)
              · model-fit σ {result.fit_sigma_cm} cm (CONUS; not local N uncertainty)
            </div>
          )}
          {result && !result.ok && (
            <div role="alert" style={{ marginTop: 8, color: '#fca5a5', fontSize: 12 }}>{result.reason}</div>
          )}
        </>
      )}
    </div>
  );
}
