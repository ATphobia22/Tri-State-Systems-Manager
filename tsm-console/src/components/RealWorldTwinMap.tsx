import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapTwinLoaderData } from '../types/loaders';
import { buildTwinStyle, applyTwinTerrain, addFloodAuthorityLayers, applyLiveStageMetadata, TWIN_ENGINEERING_CONSTANTS } from '../lib/twin-map-style';

interface RealWorldTwinMapProps {
  data: MapTwinLoaderData;
}

export default function RealWorldTwinMap({ data }: RealWorldTwinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
      mapRef.current = map;
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data]);

  const stage = data.stage.value_ft;
  const wse = data.stage.wse_navd88_ft;
  const terrainConfigured = Boolean(import.meta.env.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE?.trim());

  return (
    <section aria-label="Real-source Indiana open-world digital twin" style={{ position: 'relative', height: '100%', minHeight: 480, background: '#020617' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 2, maxWidth: 460, padding: 12, borderRadius: 10, background: 'rgba(2,6,23,0.88)', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5 }}>
        <strong>Real-source open-world twin</strong>
        <div>Indiana Current Imagery · 3DEP Terrain-RGB {terrainConfigured ? 'connected' : 'not configured'}</div>
        <div>FEMA NFHL: effective / insurance · Indiana BAFM: planning / Flood Control Act</div>
        <div>Stage: {stage == null ? 'unavailable' : `${stage.toFixed(2)} ft`} {data.stage.qualifier ? `(${data.stage.qualifier})` : ''} · {data.stage.source}</div>
        <div>WSE NAVD88: {wse == null ? 'unavailable' : `${wse.toFixed(2)} ft`} · Discharge: {data.stage.discharge_cfs == null ? 'unavailable' : `${data.stage.discharge_cfs.toLocaleString()} cfs`}</div>
        <div>Site: LAG {TWIN_ENGINEERING_CONSTANTS.lag_ft} · BFE {TWIN_ENGINEERING_CONSTANTS.bfe_ft} · Berm {TWIN_ENGINEERING_CONSTANTS.berm_crest_ft} · FFE {TWIN_ENGINEERING_CONSTANTS.ffe_ft}</div>
        <div style={{ marginTop: 6, color: '#fbbf24' }}>Visualization/model context only. HEC-RAS outputs remain SIMULATION_DEMO / MODEL_OUTPUT pending human review.</div>
      </div>
    </section>
  );
}
