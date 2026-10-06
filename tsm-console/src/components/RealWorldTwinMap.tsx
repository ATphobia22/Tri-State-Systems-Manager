import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapTwinLoaderData } from '../types/loaders';
import { buildTwinStyle, applyTwinTerrain, addFloodAuthorityLayers, applyLiveStageMetadata, addMartinHydraulicLayer, getTerrainRgbStatus } from '../lib/twin-map-style';
import { terrainRgbBlockMessage } from '../lib/terrain-rgb-contract';
import { buildArcGisImageServerExportTemplate, INDIANA_CURRENT_IMAGERY_WMS, USGS_3DEP_ELEVATION_WMS, USGS_3DEP_HILLSHADE_RENDERING_RULE } from '../lib/open-world-wms';
import { setupParcelProvenanceInspector } from '../lib/parcel-provenance';
import { playCinematicTour } from '../lib/cinematic/camera-tour';
import ThreeDTilesLayer from './ThreeDTilesLayer';

// Self-hosted 3D terrain tiles (OGC 3D Tiles 1.1, generated from USGS 3DEP).
const TERRAIN_3D_TILESET_URL = `${import.meta.env.BASE_URL}3d-tiles/terrain-3dep/tileset.json`;

// Anchor site (owner keep-data decision: docs/privacy/site-anchor-public-disclosure.md).
// The /map twin opens on the property instead of the regional envelope midpoint.
const ANCHOR: [number, number] = [-88.005075, 37.845887];

/** Tri-state region constraint: Ohio–Wabash valley (IN/IL/KY). Prevents panning off the planet. */
const TRI_STATE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-90.0, 36.0],
  [-82.0, 42.5],
];

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

function fmtElev(v: number | null): string {
  return v == null ? 'unverified' : `${v.toFixed(2)} ft`;
}

export default function RealWorldTwinMap({ data }: RealWorldTwinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [femaVisible, setFemaVisible] = useState(false);
  const [bafmVisible, setBafmVisible] = useState(false);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [tiles3DVisible, setTiles3DVisible] = useState(false);
  const [tiles3DStatus, setTiles3DStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('disabled');
  const [mapReady, setMapReady] = useState(false);
  const cinematicStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildTwinStyle(),
      center: ANCHOR,
      zoom: 14,
      pitch: 55,
      bearing: -15,
      maxPitch: 85,
      minZoom: 8,
      maxZoom: 19,
      maxBounds: TRI_STATE_MAX_BOUNDS,
      // Keeps the map from trapping iOS page scroll: first swipe scrolls the page.
      cooperativeGestures: true,
    });
    map.getCanvas().setAttribute('aria-label', 'Interactive tri-state river valley map — Ohio–Wabash valley, Indiana current imagery with USGS elevation');
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      applyTwinTerrain(map);

      const imagerySourceId = 'indiana-current-imagery-live';
      if (!map.getSource(imagerySourceId)) {
        // ImageServer exportImage: the service exposes no WMSServer endpoint
        // (verified 2026-09-30 — /WMSServer returns 404 "Invalid URL").
        map.addSource(imagerySourceId, {
          type: 'raster',
          tiles: [buildArcGisImageServerExportTemplate(INDIANA_CURRENT_IMAGERY_WMS)],
          tileSize: 512,
          attribution: 'Indiana Geographic Information Office — Current Orthophotography (CC0)',
        });
      }
      if (!map.getLayer('indiana-current-imagery-live-layer')) {
        map.addLayer({
          id: 'indiana-current-imagery-live-layer',
          type: 'raster',
          source: imagerySourceId,
          paint: { 'raster-opacity': 1 },
        }, map.getLayer('fema-nfhl-overlay') ? 'fema-nfhl-overlay' : undefined);
      }

      const elevationSourceId = 'usgs-3dep-hillshade-live';
      if (!map.getSource(elevationSourceId)) {
        // Server-side hillshade via the official 3DEP rendering rule
        // (verified live 2026-09-30; allowRasterFunction=true on the service).
        map.addSource(elevationSourceId, {
          type: 'raster',
          tiles: [buildArcGisImageServerExportTemplate(USGS_3DEP_ELEVATION_WMS, USGS_3DEP_HILLSHADE_RENDERING_RULE)],
          tileSize: 512,
          attribution: 'USGS National Map 3DEP',
        });
      }
      if (!map.getLayer('usgs-3dep-hillshade-live-layer')) {
        map.addLayer({
          id: 'usgs-3dep-hillshade-live-layer',
          type: 'raster',
          source: elevationSourceId,
          paint: { 'raster-opacity': 0.16 },
        }, map.getLayer('fema-nfhl-overlay') ? 'fema-nfhl-overlay' : undefined);
      }

      addFloodAuthorityLayers(map);
      applyLiveStageMetadata(map, data);
      // Hydraulic rendering is fail-closed: only an explicitly derived NAVD88 WSE drives water height.
      addMartinHydraulicLayer(map, data.stage.hydraulic_extrusion_eligibility === 'SITE_WSE_VERIFIED_FOR_EXTRUSION' ? data.stage.wse_navd88_ft : null);
      if (map.getLayer('tsm-hydraulic-extrusion')) setupParcelProvenanceInspector(map);
      new maplibregl.Marker().setLngLat(NEW_HARMONY_GAGE).setPopup(buildGagePopup(data)).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cinematicStopRef.current?.();
      cinematicStopRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, visible] of [['fema-nfhl-overlay', femaVisible], ['indiana-bafm-overlay', bafmVisible]] as const) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }, [femaVisible, bafmVisible]);

  const stage = data.stage.value_ft;
  const wse = data.stage.wse_navd88_ft;
  const terrainStatus = getTerrainRgbStatus();
  const terrainConfigured = terrainStatus.enabled;
  const terrainMessage = terrainRgbBlockMessage(terrainStatus);

  const toggleCinematicTour = (): void => {
    const map = mapRef.current;
    if (!map) return;
    if (cinematicActive) {
      cinematicStopRef.current?.();
      cinematicStopRef.current = null;
      setCinematicActive(false);
      return;
    }
    // Reduced-motion gate lives in playCinematicTour: it renders a static
    // frame and returns null instead of a live tour.
    const stop = playCinematicTour(map);
    if (stop === null) return;
    cinematicStopRef.current = stop;
    setCinematicActive(true);
  };

  return (
    <section aria-label="Real-source Indiana open-world digital twin" style={{ position: 'relative', height: '100%', minHeight: 480, background: '#020617' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {tiles3DVisible && mapReady && mapRef.current && (
        <ThreeDTilesLayer
          source={{
            id: 'tsm-3d-terrain',
            tilesetUrl: TERRAIN_3D_TILESET_URL,
            enabled: true,
          }}
          map={mapRef.current}
          onStatusChange={setTiles3DStatus}
          overlay
        />
      )}
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 2, maxWidth: 520, padding: 12, borderRadius: 10, background: 'rgba(2,6,23,0.9)', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5 }}>
        <strong>Real-source open-world twin</strong>
        <div>Indiana Current Imagery: live ImageServer · USGS 3DEP: dynamic elevation/hillshade (visualization only)</div>
        <div role="status">{terrainMessage}</div>
        <div>FEMA NFHL: effective / insurance · Indiana BAFM: planning / Flood Control Act</div>
        <div>Stage: {stage == null ? 'unavailable' : `${stage.toFixed(2)} ft`} {data.stage.qualifier ? `(${data.stage.qualifier})` : ''} · {data.stage.source}</div>
        <div>Station WSE NAVD88: {wse == null ? 'unavailable' : `${wse.toFixed(2)} ft`} · Datum: {data.stage.conversion_applied ? 'verified USGS station relationship' : 'blocked'} · Site transfer: {data.stage.site_transfer_status ?? 'required'} · Hydraulic extrusion: {data.stage.hydraulic_extrusion_eligibility === 'SITE_WSE_VERIFIED_FOR_EXTRUSION' ? 'enabled' : 'blocked — validated site WSE required'} · Discharge: {data.stage.discharge_cfs == null ? 'unavailable' : `${data.stage.discharge_cfs.toLocaleString()} cfs`}</div>
        <div>Site elevations: LAG {fmtElev(data.site.elevations.lag_ft)} · BFE {fmtElev(data.site.elevations.bfe_ft)} · Berm {fmtElev(data.site.elevations.bermCrest_ft)} · FFE {fmtElev(data.site.elevations.ffe_ft)}</div>
        <div style={{ color: '#94a3b8' }}>Elevation provenance: LAG/berm/FFE owner-supplied (uncertified); BFE working value per 2026-08-22 LOMA checklist (FIRM verification pending).</div>
        <div>Transfer gate: {data.stage.site_transfer_status ?? 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE'} · Station conversion source: {data.stage.vertical_conversion_source ?? 'source required'}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {([
            { id: 'fema', pressed: femaVisible, onClick: () => setFemaVisible((value) => !value), label: `FEMA NFHL ${femaVisible ? 'ON' : 'OFF'}` },
            { id: 'bafm', pressed: bafmVisible, onClick: () => setBafmVisible((value) => !value), label: `Indiana BAFM ${bafmVisible ? 'ON' : 'OFF'}` },
            { id: '3d', pressed: tiles3DVisible, onClick: () => setTiles3DVisible((value) => !value), label: `3D Terrain ${tiles3DVisible ? 'ON' : 'OFF'}` },
            { id: 'cinematic', pressed: cinematicActive, onClick: toggleCinematicTour, label: cinematicActive ? 'Stop cinematic' : 'Cinematic fly-through' },
          ] as const).map((btn) => (
            <button
              key={btn.id}
              type="button"
              aria-pressed={btn.pressed}
              onClick={btn.onClick}
              style={{
                minHeight: 44,
                padding: '0.5rem 0.9rem',
                borderRadius: 8,
                border: '1px solid #1e293b',
                background: btn.pressed ? 'rgba(56,189,248,0.18)' : '#020617',
                color: btn.pressed ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, color: '#86efac' }}>USGS 03378500: live values only via the "Fetch live snapshot" button (no auto-fetch, no polling). Station WSE via published USGS SIR 2016-5119 conversion (+352.67 ft NAVD88). Site transfer and hydraulic extrusion remain gated on a validated hydraulic profile. HEC-RAS visualization authority remains SIMULATION_DEMO / MODEL_OUTPUT until evidence gates are satisfied. Visualization/model context only; human authority remains final.</div>
        {tiles3DVisible && (
          <div style={{ marginTop: 6, color: '#94a3b8' }}>3D terrain: self-hosted OGC 3D Tiles 1.1 (USGS 3DEP) · status: {tiles3DStatus}</div>
        )}
      </div>
    </section>
  );
}
