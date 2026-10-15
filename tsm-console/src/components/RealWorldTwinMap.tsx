import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapTwinLoaderData } from '../types/loaders';
import { buildTwinStyle, applyTwinTerrain, addFloodAuthorityLayers, applyLiveStageMetadata, addMartinHydraulicLayer, getTerrainRgbStatus } from '../lib/twin-map-style';
import { terrainRgbBlockMessage } from '../lib/terrain-rgb-contract';
import { buildArcGisImageServerExportTemplate, INDIANA_CURRENT_IMAGERY_WMS, USGS_3DEP_ELEVATION_WMS, USGS_3DEP_HILLSHADE_RENDERING_RULE } from '../lib/open-world-wms';
import { setupParcelProvenanceInspector } from '../lib/parcel-provenance';
import { playCinematicTour } from '../lib/cinematic/camera-tour';
import ThreeDTilesLayer from './ThreeDTilesLayer';
import VerticalContextHud from './VerticalContextHud';
import Geoid18AoiPanel from './Geoid18AoiPanel';
import MultiStationWaterPanel from './MultiStationWaterPanel';
import LocalDamsPanel from './LocalDamsPanel';
import { fetchLiveStage } from '../lib/stage';
import { fetchAllLiveStations, type StationLiveSnapshot } from '../lib/multi-stage-fetch';
import { damsToGeoJson, type LocalDamsCatalog } from '../lib/local-dams';
import { readTwinUrlState, writeTwinUrlState } from '../lib/geodetic/twin-url-state';

const TERRAIN_3D_TILESET_URL = `${import.meta.env.BASE_URL}3d-tiles/terrain-3dep/tileset.json`;

const ANCHOR: [number, number] = [-88.005075, 37.845887];

const TRI_STATE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-90.0, 36.0],
  [-82.0, 42.5],
];

interface RealWorldTwinMapProps { data: MapTwinLoaderData; }
const NEW_HARMONY_GAGE: [number, number] = [-87.9414145, 38.13089124];

function buildGagePopup(stage: MapTwinLoaderData['stage']): maplibregl.Popup {
  const stageTxt = stage.value_ft == null ? 'unavailable' : `${stage.value_ft.toFixed(2)} ft`;
  const qualifier = stage.qualifier ? ` ${stage.qualifier}` : '';
  const wse = stage.wse_navd88_ft == null ? 'unavailable' : `${stage.wse_navd88_ft.toFixed(2)} ft NAVD88`;
  const discharge = stage.discharge_cfs == null ? 'unavailable' : `${stage.discharge_cfs.toLocaleString()} cfs`;
  const observed = stage.timestamp || 'unavailable';
  return new maplibregl.Popup().setText(`USGS 03378500 / NOAA NHRI3 | Stage: ${stageTxt}${qualifier} | WSE: ${wse} | Discharge: ${discharge} | Observed: ${observed}`);
}

export default function RealWorldTwinMap({ data }: RealWorldTwinMapProps) {
  const initialUrl = readTwinUrlState();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [liveStage, setLiveStage] = useState(data.stage);
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [multiStations, setMultiStations] = useState<StationLiveSnapshot[]>([]);
  const [multiBusy, setMultiBusy] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);

  const [femaVisible, setFemaVisible] = useState(initialUrl.fema);
  const [bafmVisible, setBafmVisible] = useState(initialUrl.bafm);
  const [noaaWarningsVisible, setNoaaWarningsVisible] = useState(initialUrl.noaaWarnings);
  const [noaaRadarVisible, setNoaaRadarVisible] = useState(initialUrl.noaaRadar);
  const [damsVisible, setDamsVisible] = useState(true);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [tiles3DVisible, setTiles3DVisible] = useState(initialUrl.tiles3d);
  const [tiles3DStatus, setTiles3DStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('disabled');
  const [mapReady, setMapReady] = useState(false);
  const [reviewPitch, setReviewPitch] = useState(false);
  const cinematicStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildTwinStyle(),
      center: ANCHOR,
      zoom: 14,
      pitch: initialUrl.pitch,
      bearing: initialUrl.bearing,
      maxPitch: 85,
      minZoom: 8,
      maxZoom: 19,
      maxBounds: TRI_STATE_MAX_BOUNDS,
      cooperativeGestures: true,
    });
    map.getCanvas().setAttribute('aria-label', 'Interactive tri-state river valley map');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('load', () => {
      applyTwinTerrain(map);

      const imagerySourceId = 'indiana-current-imagery-live';
      if (!map.getSource(imagerySourceId)) {
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

      const noaaWarningsSource = 'noaa-cloudgis-warnings';
      if (!map.getSource(noaaWarningsSource)) {
        map.addSource(noaaWarningsSource, {
          type: 'raster',
          tiles: ['https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=warnings&STYLES=&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],
          tileSize: 256,
          attribution: 'NOAA/NWS CloudGIS warnings',
        });
      }
      if (!map.getLayer('noaa-cloudgis-warnings-layer')) {
        map.addLayer({
          id: 'noaa-cloudgis-warnings-layer',
          type: 'raster',
          source: noaaWarningsSource,
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.72 },
        });
      }

      const noaaRadarSource = 'noaa-cloudgis-conus-radar';
      if (!map.getSource(noaaRadarSource)) {
        map.addSource(noaaRadarSource, {
          type: 'raster',
          tiles: ['https://opengeo.ncep.noaa.gov/geoserver/conus/conus_cref_qcd/ows?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=conus_cref_qcd&STYLES=&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],
          tileSize: 256,
          attribution: 'NOAA/NWS MRMS radar — situational awareness only',
        });
      }
      if (!map.getLayer('noaa-cloudgis-radar-layer')) {
        map.addLayer({
          id: 'noaa-cloudgis-radar-layer',
          type: 'raster',
          source: noaaRadarSource,
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.62 },
        });
      }

      applyLiveStageMetadata(map, { ...data, stage: liveStage });
      addMartinHydraulicLayer(map, liveStage.hydraulic_extrusion_eligibility === 'SITE_WSE_VERIFIED_FOR_EXTRUSION' ? liveStage.wse_navd88_ft : null);
      if (map.getLayer('tsm-hydraulic-extrusion')) setupParcelProvenanceInspector(map);
      markerRef.current = new maplibregl.Marker().setLngLat(NEW_HARMONY_GAGE).setPopup(buildGagePopup(liveStage)).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cinematicStopRef.current?.();
      cinematicStopRef.current = null;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, visible] of [
      ['fema-nfhl-overlay', femaVisible],
      ['indiana-bafm-overlay', bafmVisible],
      ['noaa-cloudgis-warnings-layer', noaaWarningsVisible],
      ['noaa-cloudgis-radar-layer', noaaRadarVisible],
      ['local-dams-circles', damsVisible],
    ] as const) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
    writeTwinUrlState({
      fema: femaVisible,
      bafm: bafmVisible,
      noaaWarnings: noaaWarningsVisible,
      noaaRadar: noaaRadarVisible,
      tiles3d: tiles3DVisible,
    });
  }, [femaVisible, bafmVisible, noaaWarningsVisible, noaaRadarVisible, tiles3DVisible, damsVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyLiveStageMetadata(map, { ...data, stage: liveStage });
    addMartinHydraulicLayer(
      map,
      liveStage.hydraulic_extrusion_eligibility === 'SITE_WSE_VERIFIED_FOR_EXTRUSION' ? liveStage.wse_navd88_ft : null,
    );
    if (markerRef.current) {
      markerRef.current.setPopup(buildGagePopup(liveStage));
    }
  }, [liveStage, data, mapReady]);

  const onFetchLive = useCallback(async () => {
    setFetchBusy(true);
    setFetchError(null);
    try {
      const next = await fetchLiveStage();
      if (next.source === 'UNAVAILABLE') {
        setFetchError('USGS snapshot unavailable. Stage remains fail-closed (no fabricated values).');
      }
      setLiveStage(next);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetchBusy(false);
    }
  }, []);

  const onFetchAllStations = useCallback(async () => {
    setMultiBusy(true);
    setMultiError(null);
    try {
      const snaps = await fetchAllLiveStations();
      setMultiStations(snaps);
      const primary = snaps.find((s) => s.stationId === '03378500');
      if (primary && primary.stage_ft != null) {
        // Refresh primary HUD stage from constellation without inventing WSE
        const refreshed = await fetchLiveStage();
        setLiveStage(refreshed);
      }
      if (snaps.every((s) => s.status === 'unavailable')) {
        setMultiError('All stations unavailable. Values remain fail-closed.');
      }
    } catch (e) {
      setMultiError(e instanceof Error ? e.message : 'Multi-station fetch failed');
    } finally {
      setMultiBusy(false);
    }
  }, []);

  const onDamsCatalog = useCallback((catalog: LocalDamsCatalog) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const gj = damsToGeoJson(catalog);
    if (map.getSource('local-dams')) {
      (map.getSource('local-dams') as maplibregl.GeoJSONSource).setData(gj);
    } else {
      map.addSource('local-dams', { type: 'geojson', data: gj });
      map.addLayer({
        id: 'local-dams-circles',
        type: 'circle',
        source: 'local-dams',
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'match',
            ['get', 'hazardPotential'],
            'High', '#ef4444',
            'Significant', '#f59e0b',
            'Low', '#a78bfa',
            '#94a3b8',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0f172a',
        },
      });
      map.on('click', 'local-dams-circles', (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const p = f.properties || {};
        new maplibregl.Popup()
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(
            `<strong>${p.name ?? 'Dam'}</strong><br/>Hazard: ${p.hazardPotential ?? '—'}<br/>Condition: ${p.condition ?? '—'}<br/>${p.ownerType ?? ''} · ${p.primaryPurpose ?? ''}<br/><em>Registry only — not a safety determination</em>`,
          )
          .addTo(map);
      });
    }
  }, [mapReady]);

  const terrainStatus = getTerrainRgbStatus();
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
    const stop = playCinematicTour(map);
    if (stop === null) return;
    cinematicStopRef.current = stop;
    setCinematicActive(true);
  };

  const applyReviewPitch = (): void => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: 55, bearing: -15, duration: 800 });
    setReviewPitch(true);
    writeTwinUrlState({ pitch: 55, bearing: -15, vert: 'NAVD88' });
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
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 2, maxWidth: 540, maxHeight: 'calc(100% - 24px)', overflow: 'auto', padding: 12, borderRadius: 10, background: 'rgba(2,6,23,0.92)', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5 }}>
        <strong>Real-source open-world twin</strong>
        <div>Indiana Current Imagery · USGS 3DEP hillshade (visualization DERIVED)</div>
        <div>FEMA NFHL: effective / insurance · Indiana BAFM: planning · NOAA/NWS: alerts/radar context only</div>

        <VerticalContextHud
          stage={liveStage}
          site={data.site}
          terrainMessage={terrainMessage}
          onFetchLive={onFetchLive}
          fetchBusy={fetchBusy}
          fetchError={fetchError}
        />

        <MultiStationWaterPanel
          stations={multiStations}
          busy={multiBusy}
          error={multiError}
          onFetchAll={onFetchAllStations}
        />

        <LocalDamsPanel onCatalog={onDamsCatalog} />

        <Geoid18AoiPanel />

        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {([
            { id: 'fema', pressed: femaVisible, onClick: () => setFemaVisible((v) => !v), label: `FEMA NFHL ${femaVisible ? 'ON' : 'OFF'}` },
            { id: 'bafm', pressed: bafmVisible, onClick: () => setBafmVisible((v) => !v), label: `Indiana BAFM ${bafmVisible ? 'ON' : 'OFF'}` },
            { id: 'noaa-warnings', pressed: noaaWarningsVisible, onClick: () => setNoaaWarningsVisible((v) => !v), label: `NWS Warnings ${noaaWarningsVisible ? 'ON' : 'OFF'}` },
            { id: 'noaa-radar', pressed: noaaRadarVisible, onClick: () => setNoaaRadarVisible((v) => !v), label: `NOAA Radar ${noaaRadarVisible ? 'ON' : 'OFF'}` },
            { id: 'dams', pressed: damsVisible, onClick: () => setDamsVisible((v) => !v), label: `Local Dams ${damsVisible ? 'ON' : 'OFF'}` },
            { id: '3d', pressed: tiles3DVisible, onClick: () => setTiles3DVisible((v) => !v), label: `3D Terrain ${tiles3DVisible ? 'ON' : 'OFF'}` },
            { id: 'review', pressed: reviewPitch, onClick: applyReviewPitch, label: reviewPitch ? 'Review pitch set' : 'Review pitch (55°)' },
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
        <div style={{ marginTop: 6, color: '#86efac' }}>
          Live water: button-only (single or constellation). No auto-fetch. Local dams = registry awareness only. Human authority remains final.
        </div>
        {tiles3DVisible && (
          <div style={{ marginTop: 6, color: '#94a3b8' }}>3D terrain: self-hosted OGC 3D Tiles 1.1 · status: {tiles3DStatus}</div>
        )}
      </div>
    </section>
  );
}
