import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapTwinLoaderData } from '../types/loaders';
import { buildTwinStyle, applyTwinTerrain, addFloodAuthorityLayers, applyLiveStageMetadata, TWIN_ENGINEERING_CONSTANTS } from '../lib/twin-map-style';

interface RealWorldTwinMapProps { data: MapTwinLoaderData; }
const NEW_HARMONY_GAGE: [number, number] = [-87.9414145, 38.13089124];

function buildGagePopup(data: MapTwinLoaderData): maplibregl.Popup {
  const stage = data.stage.value_ft == null ? 'unavailable' : `${data.stage.value_ft.toFixed(2)} ft`;
  const qualifier = data.stage.qualifier ? ` ${data.stage.qualifier}` : '';
  const wse = data.stage.wse_navd88_ft == null ? 'unavailable' : `${data.stage.wse_navd88_ft.toFixed(2)} ft NAVD88`;
  const discharge = data.stage.discharge_cfs == null ? 'unavailable' : `${data.stage.discharge_cfs.toLocaleString()} cfs`;
  const observed = data.stage.timestamp || 'unavailable';
  return new maplibregl.Popup().setText(`USGS 03378500 / NOAA NHRI3 | Stage: ${stage}${qualifier} | WSE: ${wse} | Discharge: ${discharge} | Observed: ${observed}`);
}

export default function RealWorldTwinMap({ data }: RealWorldTwinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [femaVisible, setFemaVisible] = useState(false);
  const [bafmVisible, setBafmVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildTwinStyle(),
      center: [
        (data.boundingEnvelope.minLon + data.boundingEnvelope.maxLon) / 2,
        (data.boundingEnvelope.minLat + data.boundingEnvelope.maxLat) / 2,
      ],
      zoom: 14,
      pitch: 55,
      bearing: -15,
      maxPitch: 85,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      applyTwinTerrain(map);
      addFloodAuthorityLayers(map);
      applyLiveStageMetadata(map, data);
      new maplibregl.Marker().setLngLat(NEW_HARMONY_GAGE).setPopup(buildGagePopup(data)).addTo(map);
      mapRef.current = map;
    });
    return () => { map.remove(); mapRef.current = null; };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, visible] of [['fema-nfhl-overlay', femaVisible], ['indiana-bafm-overlay', bafmVisible]] as const) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }, [femaVisible, bafmVisible]);

  const stage = data.stage.value_ft;
  const wse = data.stage.wse_navd88_ft;
  const terrainConfigured = Boolean(import.meta.env.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE?.trim());

  return (
    <section aria-label="Real-source Indiana open-world digital twin" style={{ position: 'relative', height: '100%', minHeight: 480, background: '#020617' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 2, maxWidth: 500, padding: 12, borderRadius: 10, background: 'rgba(2,6,23,0.9)', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5 }}>
        <strong>Real-source open-world twin</strong>
        <div>Indiana Current Imagery · 3DEP Terrain-RGB {terrainConfigured ? 'connected' : 'not configured'}</div>
        <div>FEMA NFHL: effective / insurance · Indiana BAFM: planning / Flood Control Act</div>
        <div>Stage: {stage == null ? 'unavailable' : `${stage.toFixed(2)} ft`} {data.stage.qualifier ? `(${data.stage.qualifier})` : ''} · {data.stage.source}</div>
        <div>WSE NAVD88: {wse == null ? 'unavailable' : `${wse.toFixed(2)} ft`} · Discharge: {data.stage.discharge_cfs == null ? 'unavailable' : `${data.stage.discharge_cfs.toLocaleString()} cfs`}</div>
        <div>Site: LAG {TWIN_ENGINEERING_CONSTANTS.lag_ft} · BFE {TWIN_ENGINEERING_CONSTANTS.bfe_ft} · Berm {TWIN_ENGINEERING_CONSTANTS.berm_crest_ft} · FFE {TWIN_ENGINEERING_CONSTANTS.ffe_ft}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button type="button" aria-pressed={femaVisible} onClick={() => setFemaVisible((value) => !value)}>FEMA NFHL {femaVisible ? 'ON' : 'OFF'}</button>
          <button type="button" aria-pressed={bafmVisible} onClick={() => setBafmVisible((value) => !value)}>Indiana BAFM {bafmVisible ? 'ON' : 'OFF'}</button>
        </div>
        <div style={{ marginTop: 6, color: '#fbbf24' }}>Visualization/model context only. HEC-RAS outputs remain SIMULATION_DEMO / MODEL_OUTPUT pending human review.</div>
      </div>
    </section>
  );
}
