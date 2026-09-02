/**
 * Real MapLibre GL map — Public Visualization Plane
 * Water extrusion and stage slider are SIMULATION_DEMO / VISUALIZATION only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { SITE } from '../types/site';
import { AuthorityBadge, SimulationDemoBanner } from '../components/AuthorityBadge';
import { assessClearanceSupport, type JurisdictionId } from '../lib/jurisdiction-rules';
import { MAP_LAYERS } from '../lib/map-layers';

const CENTER: [number, number] = [
  (SITE.boundingEnvelope.minLon + SITE.boundingEnvelope.maxLon) / 2,
  (SITE.boundingEnvelope.minLat + SITE.boundingEnvelope.maxLat) / 2,
];

function buildWaterMesh(stageFt: number, exaggeration: number) {
  const [centerLon, centerLat] = CENTER;
  const delta = Math.max(0.001, (stageFt - 365) * 0.0012);
  const height = Math.max(0, (stageFt - 360) * exaggeration * 0.5);
  const bfeHeight = Math.max(0, (SITE.elevations.bfe_ft - 360) * exaggeration * 0.5);

  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { type: 'water-plane', height, base_height: 0 },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [centerLon - delta * 2, centerLat - delta],
            [centerLon + delta, centerLat - delta * 1.5],
            [centerLon + delta * 2.5, centerLat + delta * 2],
            [centerLon - delta, centerLat + delta * 2.2],
            [centerLon - delta * 2, centerLat - delta],
          ]],
        },
      },
      {
        type: 'Feature' as const,
        properties: { type: 'bfe-contour', height: bfeHeight + 2, base_height: bfeHeight },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[
            [centerLon - 0.005, centerLat - 0.003],
            [centerLon + 0.004, centerLat - 0.004],
            [centerLon + 0.006, centerLat + 0.005],
            [centerLon - 0.003, centerLat + 0.006],
            [centerLon - 0.005, centerLat - 0.003],
          ]],
        },
      },
    ],
  };
}

export default function MapLibreMap() {
  const data = useLoaderData() as MapTwinLoaderData;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [stageFt, setStageFt] = useState(SITE.elevations.bfe_ft);
  const [exaggeration, setExaggeration] = useState(1);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionId>('INDIANA');
  const [mapReady, setMapReady] = useState(false);

  const live = data.stage.value_ft;
  const usingLive = live != null && data.stage.source !== 'MOCK';
  const displayStage = usingLive ? live : stageFt;

  const assessment = useMemo(
    () => assessClearanceSupport({
      jurisdiction,
      waterStageFt: displayStage,
      bfeFt: SITE.elevations.bfe_ft,
      lagFt: SITE.elevations.lag_ft,
    }),
    [jurisdiction, displayStage],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: CENTER,
      zoom: 13.5,
      pitch: 45,
      bearing: -20,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('water-mesh', {
        type: 'geojson',
        data: buildWaterMesh(displayStage, exaggeration),
      });
      map.addLayer({
        id: 'water-extrusion',
        type: 'fill-extrusion',
        source: 'water-mesh',
        filter: ['==', ['get', 'type'], 'water-plane'],
        paint: {
          'fill-extrusion-color': '#06b6d4',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.65,
        },
      });
      map.addLayer({
        id: 'bfe-extrusion',
        type: 'fill-extrusion',
        source: 'water-mesh',
        filter: ['==', ['get', 'type'], 'bfe-contour'],
        paint: {
          'fill-extrusion-color': '#f59e0b',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base_height'],
          'fill-extrusion-opacity': 0.4,
        },
      });

      new maplibregl.Marker({ color: '#38bdf8' })
        .setLngLat(CENTER)
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<strong>${SITE.address}</strong><br/>APN ${SITE.apn}<br/>BFE ${SITE.elevations.bfe_ft} ft NAVD88`,
          ),
        )
        .addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource('water-mesh') as maplibregl.GeoJSONSource | undefined;
    source?.setData(buildWaterMesh(displayStage, exaggeration));
  }, [displayStage, exaggeration, mapReady]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      <div style={{ padding: '0.6rem 1rem', background: '#020617', borderBottom: '1px solid #1e293b', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: '0.75rem' }}>
        <strong style={{ color: '#38bdf8' }}>MapLibre GL · {SITE.address}</strong>
        <AuthorityBadge authority_class={usingLive ? 'OBSERVATION' : 'SIMULATION_DEMO'} is_simulation_demo={!usingLive} />
        <span style={{ color: '#94a3b8' }}>Stage {displayStage.toFixed(2)} ft · {data.stage.source} {data.stage.gaugeId}</span>
        <span style={{ color: '#64748b' }}>Mesh = VISUALIZATION only · not engineering prediction</span>
      </div>

      {!usingLive && <div style={{ padding: '0.35rem 1rem' }}><SimulationDemoBanner /></div>}

      <div style={{ flex: 1, position: 'relative', minHeight: 320 }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: '0.75rem 1rem', background: '#0f172a', borderTop: '1px solid #1e293b', fontSize: '0.8rem' }}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginBottom: 4 }}>DEMO STAGE (ft NAVD88)</div>
          <input type="range" min={365} max={390} step={0.05} value={stageFt} onChange={(event) => setStageFt(parseFloat(event.target.value))} style={{ width: '100%' }} disabled={usingLive} />
          <div style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{stageFt.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginBottom: 4 }}>Z EXAGGERATION</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2.5, 5].map((z) => (
              <button key={z} type="button" onClick={() => setExaggeration(z)} style={{ flex: 1, padding: '0.35rem', borderRadius: 6, border: exaggeration === z ? '1px solid #22d3ee' : '1px solid #334155', background: exaggeration === z ? 'rgba(34,211,238,0.15)' : '#1e293b', color: '#e2e8f0', cursor: 'pointer', fontSize: '0.75rem' }}>{z}x</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginBottom: 4 }}>JURISDICTION (citations)</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['INDIANA', 'ILLINOIS', 'KENTUCKY'] as JurisdictionId[]).map((currentJurisdiction) => (
              <button key={currentJurisdiction} type="button" onClick={() => setJurisdiction(currentJurisdiction)} style={{ flex: 1, padding: '0.35rem', fontSize: '0.65rem', fontWeight: 700, borderRadius: 6, border: jurisdiction === currentJurisdiction ? '1px solid #a78bfa' : '1px solid #334155', background: jurisdiction === currentJurisdiction ? 'rgba(167,139,250,0.15)' : '#1e293b', color: jurisdiction === currentJurisdiction ? '#a78bfa' : '#94a3b8', cursor: 'pointer' }}>{currentJurisdiction.slice(0, 3)}</button>
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#cbd5e1' }}>{assessment.code}: {assessment.finding}</div>
        </div>
      </div>

      <div style={{ padding: '0.5rem 1rem', background: '#020617', borderTop: '1px solid #1e293b', fontSize: '0.7rem', color: '#94a3b8' }}>
        <strong style={{ color: '#64748b' }}>LAYER CATALOG (add via MapServer export / future vector tiles): </strong>
        {MAP_LAYERS.filter((layer) => layer.id !== 'osm-base').map((layer) => <span key={layer.id} style={{ marginRight: 10 }}>{layer.title} [{layer.authority_class}]</span>)}
        · FEMA NFHL and Indiana BAFM must both remain available and never collapsed.
      </div>
    </div>
  );
}
