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
import type { ThreeDTilesSource } from '../lib/martin-tile-fabric';
import VerticalContextHud from './VerticalContextHud';
import Geoid18AoiPanel from './Geoid18AoiPanel';
import MultiStationWaterPanel from './MultiStationWaterPanel';
import LocalDamsPanel from './LocalDamsPanel';
import ScenarioStudioPanel from './ScenarioStudioPanel';
import LiveShadowPanel from './LiveShadowPanel';
import FacilityStatusDashboard from './FacilityStatusDashboard';
import PublicEvidenceLens from './PublicEvidenceLens';
import { SessionLiveShadow, type LiveShadowStatus } from '../lib/session-live-shadow';
import { applyScenarioCascadeLayer } from '../lib/scenario-cascade-layer';
import type { ScenarioStudioResult } from '../lib/scenario-studio';
import { fetchLiveStage } from '../lib/stage';
import { fetchAllLiveStations, type StationLiveSnapshot } from '../lib/multi-stage-fetch';
import { damsToGeoJson, type LocalDamsCatalog } from '../lib/local-dams';
import { readTwinUrlState, writeTwinUrlState } from '../lib/geodetic/twin-url-state';
import { attachSupabaseParcelBboxLayer } from '../lib/supabase-parcel-bbox';
import { attachConfiguredPmtilesPolygonLayer } from '../lib/pmtiles-overlay';
import { attachGovernmentPmtilesLayer, GOVERNMENT_SCENE_STATUS_EVENT, type GovernmentSceneDetail } from '../lib/government-pmtiles-overlay';
import { attachMountVernonCityScene } from '../lib/mount-vernon-city-scene';
import MountVernonCityInspector from './MountVernonCityInspector';
import { attachIndianaFeatureFabric, type IndianaFeatureFabric, type IndianaFeatureKind, type IndianaFeatureState } from '../lib/open-world-feature-fabric';
import { inspectOpenWorldPlanes } from '../lib/open-world-layer-inventory';

const TERRAIN_3D_TILESET_URL = `${import.meta.env.BASE_URL}3d-tiles/terrain-3dep/tileset.json`;
const BUILDING_3D_TILESET_URL = `${import.meta.env.BASE_URL}3d-tiles/buildings-lidar-12450/tileset.json`;
const TERRAIN_3D_SOURCE: ThreeDTilesSource = {
  id: 'tsm-3d-terrain', tilesetUrl: TERRAIN_3D_TILESET_URL, enabled: true,
};
const BUILDING_3D_SOURCE: ThreeDTilesSource = {
  id: 'tsm-3d-buildings-derived-subset', tilesetUrl: BUILDING_3D_TILESET_URL, enabled: true,
};

// Approximate city-scale starting point, never a residential parcel or site centroid.
const REGIONAL_CENTER: [number, number] = [-87.90, 37.93];

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
  const indianaFeatureRef = useRef<IndianaFeatureFabric | null>(null);
  const [indianaVisibility, setIndianaVisibility] = useState<Record<IndianaFeatureKind, boolean>>({
    parcels: false, roads: false, buildings: false,
  });
  const [indianaStates, setIndianaStates] = useState<Partial<Record<IndianaFeatureKind, IndianaFeatureState>>>({});

  const [liveStage, setLiveStage] = useState(data.stage);
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [multiStations, setMultiStations] = useState<StationLiveSnapshot[]>([]);
  const [multiBusy, setMultiBusy] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [shadowStatus, setShadowStatus] = useState<LiveShadowStatus>({
    enabled: false,
    lastFetchAt: null,
    ageMs: null,
    stale: false,
    error: null,
    ticks: 0,
    sessionStartedAt: null,
    autoStoppedReason: null,
  });
  const shadowRef = useRef<SessionLiveShadow | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioStudioResult | null>(null);

  const [femaVisible, setFemaVisible] = useState(initialUrl.fema);
  const [bafmVisible, setBafmVisible] = useState(initialUrl.bafm);
  const [noaaWarningsVisible, setNoaaWarningsVisible] = useState(initialUrl.noaaWarnings);
  const [noaaRadarVisible, setNoaaRadarVisible] = useState(initialUrl.noaaRadar);
  const [damsVisible, setDamsVisible] = useState(true);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [tiles3DVisible, setTiles3DVisible] = useState(initialUrl.tiles3d);
  const [buildingTiles3DVisible, setBuildingTiles3DVisible] = useState(false);
  const [evidenceLensVisible, setEvidenceLensVisible] = useState(false);
  const [tiles3DStatus, setTiles3DStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('disabled');
  const [buildingTiles3DStatus, setBuildingTiles3DStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('disabled');
  const [governmentScene, setGovernmentScene] = useState<GovernmentSceneDetail>({
    status: 'CHECKING_GOVERNMENT_SNAPSHOT', agency: null, capturedAt: null,
    source: null, sourceVersion: null, datasetId: null, validation: null,
    tilesSha256: null, sourceSha256: null, merkleRootSha256: null,
    archiveBytesVerified: false, sourceBytesIndependentlyVerified: false,
    authoritativeEngineeringUse: false, regulatoryApproval: false,
    reason: 'Checking previously verified government snapshots.',
  });
  const [mapReady, setMapReady] = useState(false);
  const [mapInitializationError, setMapInitializationError] = useState<string | null>(null);
  const [reviewPitch, setReviewPitch] = useState(false);
  const cinematicStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<GovernmentSceneDetail>).detail;
      if (detail?.status) setGovernmentScene(detail);
    };
    window.addEventListener(GOVERNMENT_SCENE_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(GOVERNMENT_SCENE_STATUS_EVENT, onStatus);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposeParcelBboxLayer: (() => void) | null = null;
    let disposePmtilesLayer: (() => void) | null = null;
    let disposeGovernmentPmtilesLayer: (() => void) | null = null;
    const mountVernonCityCleanup: { dispose: (() => void) | null } = { dispose: null };
    const mountVernonSceneAbort = new AbortController();
    let citySceneDisposed = false;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: buildTwinStyle(),
        center: REGIONAL_CENTER,
        zoom: 12,
        pitch: initialUrl.pitch,
        bearing: initialUrl.bearing,
        maxPitch: 85,
        minZoom: 8,
        maxZoom: 19,
        maxBounds: TRI_STATE_MAX_BOUNDS,
        cooperativeGestures: true,
      });
      setMapInitializationError(null);
    } catch (error) {
      setMapInitializationError(error instanceof Error ? error.message : 'MapLibre could not initialize the map canvas.');
      setMapReady(false);
      return;
    }
    map.getCanvas().setAttribute('aria-label', 'Interactive tri-state river valley map');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('load', () => {
      try {
        applyTwinTerrain(map);
      } catch (error) {
        setMapInitializationError('3D terrain unavailable: ' + (error instanceof Error ? error.message : 'terrain source could not initialize') + '. The 2D map and independent layers remain available.');
      }

      const imagerySourceId = 'indiana-current-imagery-live';
      if (!map.getSource(imagerySourceId)) {
        map.addSource(imagerySourceId, {
          type: 'raster',
          tiles: [buildArcGisImageServerExportTemplate(INDIANA_CURRENT_IMAGERY_WMS)],
          tileSize: 512,
          attribution: 'Indiana Geographic Information Office \u2014 Current Orthophotography (CC0)',
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
      // Optional public-safe PostGIS parcel lookup; keep map usability if unavailable.
      try {
        disposeParcelBboxLayer = attachSupabaseParcelBboxLayer(map);
      } catch {
        setMapInitializationError('Optional parcel layer unavailable; the base map remains usable.');
      }
      // Optional immutable vector archive; configured .pmtiles URL only.
      try {
        disposePmtilesLayer = attachConfiguredPmtilesPolygonLayer(map);
        disposeGovernmentPmtilesLayer = attachGovernmentPmtilesLayer(map);
      } catch {
        setMapInitializationError('Optional PMTiles layer unavailable; the base map remains usable.');
      }
      // The city scene is independent of the optional PMTiles transport.
      void attachMountVernonCityScene(map, `${import.meta.env.BASE_URL}mount-vernon-scene/`, mountVernonSceneAbort.signal).then(dispose => {
        if (citySceneDisposed) dispose();
        else mountVernonCityCleanup.dispose = dispose;
      });

      const noaaWarningsSource = 'noaa-cloudgis-warnings';
      if (!map.getSource(noaaWarningsSource)) {
        map.addSource(noaaWarningsSource, {
          type: 'raster',
          tiles: ['https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=warnings&STYLES=&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],
          tileSize: 256,
          attribution: 'NOAA/National Weather Service CloudGIS \u2014 warnings; operational status and layer availability may change',
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
          attribution: 'NOAA/NWS Multi-Radar/Multi-Sensor (MRMS) composite radar \u2014 situational awareness only',
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
      try {
        indianaFeatureRef.current = attachIndianaFeatureFabric(map, next => {
          setIndianaStates(previous => ({ ...previous, [next.kind]: next }));
        });
      } catch (error) {
        setMapInitializationError('Reference geometry fabric unavailable: ' +
          (error instanceof Error ? error.message : 'map layers could not initialize'));
      }
      markerRef.current = new maplibregl.Marker().setLngLat(NEW_HARMONY_GAGE).setPopup(buildGagePopup(liveStage)).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      cinematicStopRef.current?.();
      cinematicStopRef.current = null;
      disposeParcelBboxLayer?.();
      disposePmtilesLayer?.();
      disposeGovernmentPmtilesLayer?.();
      indianaFeatureRef.current?.dispose();
      indianaFeatureRef.current = null;
      citySceneDisposed = true;
      mountVernonSceneAbort.abort();
      mountVernonCityCleanup.dispose?.();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!mapReady || !indianaFeatureRef.current) return;
    for (const kind of ['parcels', 'roads', 'buildings'] as const) {
      indianaFeatureRef.current.setEnabled(kind, indianaVisibility[kind]);
    }
  }, [mapReady, indianaVisibility]);

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
        setFetchError('USGS snapshot unavailable. Stage is not displayed; the map remains available.');
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
        const refreshed = await fetchLiveStage();
        setLiveStage(refreshed);
      }
      if (snaps.every((s) => s.status === 'unavailable')) {
        setMultiError('All stations unavailable. Observation cards show unavailable status; the map remains available.');
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
            `<strong>${p.name ?? 'Dam'}</strong><br/>Hazard: ${p.hazardPotential ?? '\u2014'}<br/>Condition: ${p.condition ?? '\u2014'}<br/>${p.ownerType ?? ''} \u00b7 ${p.primaryPurpose ?? ''}<br/><em>Registry only \u2014 not a safety determination</em>`,
          )
          .addTo(map);
      });
    }
  }, [mapReady]);

  const onScenarioResult = useCallback((result: ScenarioStudioResult | null) => {
    setScenarioResult(result);
    const map = mapRef.current;
    if (!map || !mapReady) return;
    applyScenarioCascadeLayer(map, result);
  }, [mapReady]);

  useEffect(() => {
    const shadow = new SessionLiveShadow({
      onStations: setMultiStations,
      onPrimaryStage: setLiveStage,
      onStatus: setShadowStatus,
    });
    shadowRef.current = shadow;
    return () => {
      shadow.dispose();
      shadowRef.current = null;
    };
  }, []);

  const onShadowToggle = useCallback((enable: boolean) => {
    const s = shadowRef.current;
    if (!s) return;
    if (enable) s.start();
    else s.stop('user_stop');
  }, []);

  const terrainStatus = getTerrainRgbStatus();
  const terrainMessage = terrainRgbBlockMessage(terrainStatus);
  const mapForInventory = mapReady ? mapRef.current : null;
  const openWorldPlanes = inspectOpenWorldPlanes({
    hasMapLayer: id => !!mapForInventory?.getLayer(id),
    isMapLayerVisible: id => !!mapForInventory?.getLayer(id) && mapForInventory.getLayoutProperty(id, 'visibility') !== 'none',
    terrainEnabled: !!mapForInventory?.getTerrain(),
    gaugeMarkerAvailable: !!markerRef.current && mapReady,
    featureStates: {
      parcels: indianaStates.parcels?.status,
      roads: indianaStates.roads?.status,
      buildings: indianaStates.buildings?.status,
    },
    presentationEnabled: true,
    buildingTiles3DStatus: buildingTiles3DVisible ? buildingTiles3DStatus : 'disabled',
  });

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
      {mapInitializationError && (
        <div role="status" aria-live="polite" style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 25, maxWidth: 'min(92%, 520px)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(251,191,36,.4)', background: 'rgba(15,23,42,.94)', color: '#fde68a', fontSize: 12, lineHeight: 1.5, pointerEvents: 'none' }}>
          Map rendering degraded: {mapInitializationError}. Other panels and controls remain available.
        </div>
      )}
      {tiles3DVisible && mapReady && mapRef.current && (
        <ThreeDTilesLayer
          source={TERRAIN_3D_SOURCE}
          map={mapRef.current}
          onStatusChange={setTiles3DStatus}
          overlay
        />
      )}
      {buildingTiles3DVisible && mapReady && mapRef.current && (
        <ThreeDTilesLayer
          source={BUILDING_3D_SOURCE}
          map={mapRef.current}
          onStatusChange={setBuildingTiles3DStatus}
          overlay
        />
      )}
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 2, maxWidth: 540, maxHeight: 'calc(100% - 24px)', overflow: 'auto', padding: 12, borderRadius: 10, background: 'rgba(2,6,23,0.92)', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5 }}>
        <strong>Real-source open-world twin</strong>
        <div>Indiana Current Imagery \u00b7 USGS 3DEP hillshade (visualization DERIVED)</div>
        <div>FEMA NFHL: effective / insurance \u00b7 Indiana BAFM: planning / Flood Control Act \u00b7 NOAA/NWS: alerts/radar context only</div>
        <div role="note" aria-label="Model evidence limitation" style={{ marginTop: 4, color: '#fbbf24' }}>HEC-RAS layers: SIMULATION_DEMO / MODEL_OUTPUT \u00b7 Visualization/model context only; not a regulatory determination.</div>
        <div role="status" aria-live="polite" aria-label="Government snapshot provenance"
          style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(15,23,42,.95)', borderRadius: 8,
            border: '1px solid rgba(251,191,36,.35)', overflowWrap: 'anywhere' }}>
          <strong style={{ color: governmentScene.status === 'CURRENT_GOVERNMENT_SNAPSHOT' ? '#86efac'
            : governmentScene.status === 'HISTORICAL_GOVERNMENT_FALLBACK' ? '#fbbf24' : '#cbd5e1' }}>
            {governmentScene.status === 'HISTORICAL_GOVERNMENT_FALLBACK'
              ? 'HISTORICAL GOVERNMENT SNAPSHOT — NOT LIVE'
              : governmentScene.status === 'CURRENT_GOVERNMENT_SNAPSHOT'
                ? 'DATED GOVERNMENT SNAPSHOT — VIEWING CONTEXT'
                : governmentScene.status === 'CHECKING_GOVERNMENT_SNAPSHOT'
                  ? 'Checking government archives…'
                  : 'Government archive unavailable — 3D twin remains usable'}
          </strong>
          <div>{governmentScene.reason}</div>
          {governmentScene.status !== 'NO_GOVERNMENT_SNAPSHOT' && governmentScene.status !== 'CHECKING_GOVERNMENT_SNAPSHOT' && (
            <>
              <div><strong>Source:</strong> {governmentScene.agency ?? 'Unspecified agency'} · {governmentScene.datasetId ?? 'Unknown dataset'}</div>
              <div><strong>Retrieved:</strong> {governmentScene.capturedAt ?? 'Not evidenced'} · <strong>Source version:</strong> {governmentScene.sourceVersion ?? 'Not evidenced'}</div>
              <div><strong>Archive integrity:</strong> {governmentScene.archiveBytesVerified ? 'Runtime SHA-256 verified' : 'Build-pinned Merkle receipt; runtime bytes not independently hashed'} · <strong>Field validation:</strong> {governmentScene.validation ?? 'Not evidenced'}</div>
              {governmentScene.source && <a href={governmentScene.source} target="_blank" rel="noopener noreferrer"
                style={{ color: '#93c5fd' }}>Source record / provenance</a>}
              <details style={{ marginTop: 4 }}>
                <summary>Exact provenance digests</summary>
                <div>Archive SHA-256: <code>{governmentScene.tilesSha256}</code></div>
                <div>Source digest (declared; original bytes not re-verified): <code>{governmentScene.sourceSha256}</code></div>
                <div>Merkle root (release pin expected for historical snapshots): <code>{governmentScene.merkleRootSha256 ?? 'Not supplied'}</code></div>
              </details>
            </>
          )}
          <div style={{ color: '#fbbf24' }}>Snapshot display is not a new FEMA determination, live observation, surveyed control or engineering approval.</div>
        </div>

        <details style={{ marginTop: 10, marginBottom: 8, padding: 8, border: '1px solid #334155', borderRadius: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Open-world structural planes (12) · runtime evidence</summary>
          <div role="note" style={{ color: '#fbbf24', margin: '6px 0' }}>
            Layer registration proves neither successful source download nor surveyed/engineering accuracy.
            Missing planes stay explicitly unavailable; cinematic outputs cannot become evidence.
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {openWorldPlanes.map(entry => (
              <div key={entry.plane.id} style={{ padding: '5px 7px', background: '#0f172a', borderRadius: 4 }}>
                <div><strong>{String(entry.plane.index).padStart(2, '0')} · {entry.plane.title}</strong></div>
                <div style={{ color: entry.readiness === 'NOT_RENDERED' || entry.readiness === 'SOURCE_UNAVAILABLE' ? '#fbbf24' : '#93c5fd' }}>
                  {entry.plane.authority} · {entry.readiness}
                </div>
                <div style={{ color: '#94a3b8' }}>{entry.plane.limitation}</div>
              </div>
            ))}
          </div>
        </details>

        <MountVernonCityInspector />

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

        <LiveShadowPanel status={shadowStatus} onToggle={onShadowToggle} />

        <LocalDamsPanel onCatalog={onDamsCatalog} />

        <Geoid18AoiPanel />

        <ScenarioStudioPanel onResult={onScenarioResult} />

        <FacilityStatusDashboard
          compact
          scenarioResult={scenarioResult}
          stations={multiStations}
        />

        <details style={{ marginTop: 10, border: '1px solid #334155', borderRadius: 8, padding: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Map overlays and camera controls</summary>
          <p style={{ color: '#94a3b8', margin: '6px 0' }}>Turn reference layers on or off; requests occur only after enabling them.</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {([
            { id: 'fema', pressed: femaVisible, onClick: () => setFemaVisible((v) => !v), label: `FEMA NFHL ${femaVisible ? 'ON' : 'OFF'}` },
            { id: 'bafm', pressed: bafmVisible, onClick: () => setBafmVisible((v) => !v), label: `Indiana BAFM ${bafmVisible ? 'ON' : 'OFF'}` },
            { id: 'noaa-warnings', pressed: noaaWarningsVisible, onClick: () => setNoaaWarningsVisible((v) => !v), label: `NWS Warnings ${noaaWarningsVisible ? 'ON' : 'OFF'}` },
            { id: 'noaa-radar', pressed: noaaRadarVisible, onClick: () => setNoaaRadarVisible((v) => !v), label: `NOAA Radar ${noaaRadarVisible ? 'ON' : 'OFF'}` },
            { id: 'dams', pressed: damsVisible, onClick: () => setDamsVisible((v) => !v), label: `Local Dams ${damsVisible ? 'ON' : 'OFF'}` },
            { id: '3d', pressed: tiles3DVisible, onClick: () => setTiles3DVisible((v) => !v), label: `3D Terrain ${tiles3DVisible ? 'ON' : 'OFF'}` },
            { id: 'buildings3d', pressed: buildingTiles3DVisible, onClick: () => setBuildingTiles3DVisible(v => !v),
              label: `3D Buildings (partial) ${buildingTiles3DVisible ? 'ON' : 'OFF'}` },
            ...(['parcels', 'roads', 'buildings'] as const).map(kind => ({
              id: kind,
              pressed: indianaVisibility[kind],
              onClick: () => setIndianaVisibility(current => ({ ...current, [kind]: !current[kind] })),
              label: `IGIO ${kind} ${indianaVisibility[kind] ? 'ON' : 'OFF'}`,
            })),
            { id: 'evidence-lens', pressed: evidenceLensVisible, onClick: () => setEvidenceLensVisible((v) => !v), label: evidenceLensVisible ? 'Hide evidence lens' : 'Show evidence lens' },
            { id: 'review', pressed: reviewPitch, onClick: applyReviewPitch, label: reviewPitch ? 'Review pitch set' : 'Review pitch (55\u00b0)' },
            { id: 'mount-vernon', pressed: false, onClick: () => mapRef.current?.flyTo({ center: [-87.895, 37.932], zoom: 15, pitch: 60, bearing: -18, duration: 1600 }), label: 'Explore Mount Vernon' },
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
        <div aria-live="polite" style={{ marginTop: 8, color: '#cbd5e1' }}>
          {(['parcels', 'roads', 'buildings'] as const).map(kind => (
            <div key={kind}>IGIO {kind}: {indianaStates[kind]?.status ?? 'DISABLED'}
              {indianaStates[kind]?.count ? ` · ${indianaStates[kind]?.count} features` : ''}
              {' · '}{indianaStates[kind]?.detail ?? 'Opt-in, bounded 2D reference geometry; zoom 14+ required.'}
            </div>
          ))}
          <div style={{ color: '#fbbf24' }}>IGIO coverage is Indiana only; no IL/KY parcel, road or building completeness is implied.</div>
        </div>
        </details>
        {evidenceLensVisible && (
          <PublicEvidenceLens
            stage={liveStage}
            government={governmentScene}
            tiles={{ enabled: tiles3DVisible, status: tiles3DStatus }}
          />
        )}
        <div style={{ marginTop: 6, color: '#86efac' }}>
          Live water: button-only by default; opt-in session shadow available (auto-stops). Local dams = registry awareness only. Scenario cascade pins = SIMULATION_DEMO screening only. Facility dashboard = screening context, not SCADA. HEC-RAS remains SIMULATION_DEMO until evidence gates pass. Source required for verified datum conversion; unavailable stays unavailable. Human authority remains final.
        </div>
        {tiles3DVisible && (
          <div style={{ marginTop: 6, color: '#94a3b8' }}>3D terrain: self-hosted OGC 3D Tiles 1.1 \u00b7 status: {tiles3DStatus}</div>
        )}
        {buildingTiles3DVisible && (
          <div style={{ marginTop: 6, color: '#fbbf24' }}>
            3D buildings: LiDAR-derived pilot tile subset · tileset state: {buildingTiles3DStatus}.
            No claim of all 23,082 identities, LoD2–4 acceptance, verified vertical datum or complete Posey coverage.
          </div>
        )}
      </div>
    </section>
  );
}
