/**
 * MapLibre helpers for Scenario Studio cascade pins (SIMULATION_DEMO).
 */
import { Popup, type Map as MaplibreMap, type GeoJSONSource } from 'maplibre-gl';
import {
  impactsToGeoJson,
  SCREENING_CRITICAL_FACILITIES,
  type ScenarioStudioResult,
} from './scenario-studio';

const SRC = 'scenario-cascade';
const LAYER = 'scenario-cascade-circles';

export function applyScenarioCascadeLayer(
  map: MaplibreMap,
  result: ScenarioStudioResult | null,
): void {
  const gj = impactsToGeoJson(SCREENING_CRITICAL_FACILITIES, result);
  if (map.getSource(SRC)) {
    (map.getSource(SRC) as GeoJSONSource).setData(gj);
  } else {
    map.addSource(SRC, { type: 'geojson', data: gj });
    map.addLayer({
      id: LAYER,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-radius': [
          'match',
          ['get', 'severity'],
          'severe',
          11,
          'elevated',
          9,
          'watch',
          7,
          5,
        ],
        'circle-color': [
          'match',
          ['get', 'severity'],
          'severe',
          '#f87171',
          'elevated',
          '#fbbf24',
          'watch',
          '#38bdf8',
          '#64748b',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0f172a',
        'circle-opacity': 0.9,
      },
    });
    map.on('click', LAYER, (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const prop = f.properties || {};
      new Popup()
        .setLngLat(f.geometry.coordinates as [number, number])
        .setHTML(
          `<strong>${prop.name ?? 'Asset'}</strong><br/>` +
            `Severity: ${prop.severity ?? '—'} · score ${prop.score ?? '—'}<br/>` +
            `<em>SIMULATION_DEMO / SCENARIO — not a field determination</em>`,
        )
        .addTo(map);
    });
  }
  if (map.getLayer(LAYER)) {
    map.setLayoutProperty(LAYER, 'visibility', result ? 'visible' : 'none');
  }
}
