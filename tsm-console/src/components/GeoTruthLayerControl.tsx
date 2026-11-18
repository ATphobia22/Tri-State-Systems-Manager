import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map, MapMouseEvent } from 'maplibre-gl';
import {
  buildGeoTruthMapData,
  GEOTRUTH_SOURCE_ID, GEOTRUTH_FILL_ID, GEOTRUTH_OUTLINE_ID,
} from '../lib/geotruth-map-layer';

const MAX_BYTES = 36 * 1024 * 1024;
type GeoTruthData = ReturnType<typeof buildGeoTruthMapData>;

async function fetchPublishedBuildings(signal: AbortSignal): Promise<GeoTruthData> {
  // Always use the same-origin, published informational GeoJSON, not a
  // remote source and not a fabricated fallback polygon.
  const sourceUrl = new URL(`${import.meta.env.BASE_URL}3d-tiles/buildings-3d.json`, window.location.origin);
  if (sourceUrl.origin !== window.location.origin) throw new Error('Cross-origin GeoTruth data disabled');
  const response = await fetch(sourceUrl.href, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Published building GeoJSON unavailable (HTTP ${response.status})`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) throw new Error('Published building source exceeds safety limit');
  const raw = await response.arrayBuffer();
  if (raw.byteLength > MAX_BYTES) throw new Error('Published building source exceeds safety limit');
  const payload: unknown = JSON.parse(new TextDecoder().decode(raw));
  return buildGeoTruthMapData(payload);
}

function clearGeoTruth(map: Map): void {
  // Remove only our own source/layers; never interfere with the base GIS.
  if (map.getLayer(GEOTRUTH_OUTLINE_ID)) map.removeLayer(GEOTRUTH_OUTLINE_ID);
  if (map.getLayer(GEOTRUTH_FILL_ID)) map.removeLayer(GEOTRUTH_FILL_ID);
  if (map.getSource(GEOTRUTH_SOURCE_ID)) map.removeSource(GEOTRUTH_SOURCE_ID);
}

function installGeoTruth(map: Map, data: GeoTruthData): void {
  if (!map.isStyleLoaded()) return;
  if (!map.getSource(GEOTRUTH_SOURCE_ID)) {
    map.addSource(GEOTRUTH_SOURCE_ID, {
      type: 'geojson',
      data: data.data as Parameters<GeoJSONSource['setData']>[0],
    });
  }
  if (!map.getLayer(GEOTRUTH_FILL_ID)) {
    map.addLayer({
      id: GEOTRUTH_FILL_ID,
      type: 'fill',
      source: GEOTRUTH_SOURCE_ID,
      paint: {
        'fill-opacity': 0.32,
        'fill-color': [
          'match', ['get', 'qaStatus'],
          'HEIGHT_ESTIMATE_UNVERIFIED', '#f59e0b',
          'HEIGHT_NOT_EVIDENCED', '#ef4444',
          'HEIGHT_INVALID', '#dc2626',
          'SOURCE_ID_UNAVAILABLE', '#a855f7',
          'SOURCE_ID_CONFLICT', '#a855f7',
          'DUPLICATE_SOURCE_ID', '#a855f7',
          '#64748b',
        ],
      },
    });
  }
  if (!map.getLayer(GEOTRUTH_OUTLINE_ID)) {
    map.addLayer({
      id: GEOTRUTH_OUTLINE_ID, type: 'line', source: GEOTRUTH_SOURCE_ID,
      paint: { 'line-color': '#e2e8f0', 'line-opacity': 0.55, 'line-width': 0.45 },
    });
  }
}

/**
 * A self-contained, collapsible opt-in QA control. The layer is never fetched
 * until the user enables it. Hidden source / API failures do not block the
 * public base map or 3D rendering.
 */
export default function GeoTruthLayerControl({ map }: { map: Map | null }): JSX.Element {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('OFF — published screening QA, source datum unverified');
  const [counts, setCounts] = useState<GeoTruthData['counts'] | null>(null);
  const [featureCount, setFeatureCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const cached = useRef<GeoTruthData | null>(null);

  function resetQaOverlay(): void {
    setEnabled(false);
    setStatus('OFF — published screening QA, source datum unverified');
    setCounts(null);
    setFeatureCount(null);
    setSelected(null);
  }

  useEffect(() => {
    if (!map) return;
    if (!enabled) {
      clearGeoTruth(map);
      return;
    }
    let disposed = false;
    const abort = new AbortController();
    const onClick = (event: MapMouseEvent) => {
      if (!map.getLayer(GEOTRUTH_FILL_ID)) return;
      const found = map.queryRenderedFeatures(event.point, { layers: [GEOTRUTH_FILL_ID] });
      if (!found.length) return;
      const props = found[0].properties ?? {};
      const label = props.sourceObjectId == null ? 'UNRESOLVED ID' : String(props.sourceObjectId);
      setSelected(`OBJECTID ${label} — ${String(props.qaStatus ?? 'UNREVIEWED')}; not surveyed`);
    };
    const onStyleLoad = () => {
      if (!disposed && cached.current) installGeoTruth(map, cached.current);
    };
    map.on('click', onClick);
    map.on('style.load', onStyleLoad);
    const begin = async () => {
      try {
        setStatus('Loading published Posey screening footprints for informational QA…');
        const data = cached.current ?? await fetchPublishedBuildings(abort.signal);
        if (disposed) return;
        cached.current = data;
        setCounts(data.counts);
        setFeatureCount(data.sourceFeatureCount);
        installGeoTruth(map, data);
        setStatus(`QA available: ${data.sourceFeatureCount.toLocaleString()} published records. Source metadata, actual heights, geometry accuracy and NAVD88 remain unverified.`);
      } catch (error) {
        if (disposed || abort.signal.aborted) return;
        setStatus(`SOURCE_UNAVAILABLE — ${error instanceof Error ? error.message : 'GeoTruth source not available'}. Base map unaffected.`);
        setEnabled(false);
      }
    };
    void begin();
    return () => {
      disposed = true;
      abort.abort();
      map.off('click', onClick);
      map.off('style.load', onStyleLoad);
      // The public QA is a temporary presentation layer; unload on collapse,
      // toggle-off or viewer unmount.
      clearGeoTruth(map);
    };
  }, [enabled, map]);

  return (
    <details aria-label="GeoTruth building quality inspector"
      onToggle={event => {
        // A collapsed inspector must not leave an invisible active map layer.
        // The enabled effect cleans up the source/layers and click listeners.
        if (!event.currentTarget.open) resetQaOverlay();
      }}
      style={{
      marginTop: 10, border: '1px solid #94a3b8', borderRadius: 8,
      padding: 8, background: 'rgba(15,23,42,.08)', color: 'inherit',
    }}>
      <summary style={{ cursor: 'pointer', fontWeight: 650 }}>
        GeoTruth · Building QA (source-derived, not surveyed)
      </summary>
      <button type="button" disabled={!map} aria-pressed={enabled}
        onClick={() => {
          if (enabled) resetQaOverlay();
          else { setSelected(null); setEnabled(true); }
        }}
        style={{ marginTop: 9, minHeight: 44, padding: '8px 12px', borderRadius: 7,
          background: enabled ? '#065f46' : '#334155', color: '#fff', border: '1px solid #94a3b8',
          cursor: map ? 'pointer' : 'not-allowed' }}>
        {enabled ? 'Hide QA layer' : 'Load QA layer (opt-in)'}
      </button>
      <div role="status" aria-live="polite" style={{ marginTop: 8, fontSize: 12, overflowWrap: 'anywhere' }}>{status}</div>
      {enabled && counts && <div style={{ marginTop: 7, fontSize: 12 }}>
        <div>Published screening features: {featureCount?.toLocaleString() ?? 'Unknown'}. This is not proof of complete 23,082-source coverage.</div>
        <div><span style={{ color: '#f59e0b' }}>■</span> Imported height estimates: {counts.HEIGHT_ESTIMATE_UNVERIFIED}</div>
        <div><span style={{ color: '#ef4444' }}>■</span> Missing/invalid heights: {counts.HEIGHT_NOT_EVIDENCED + counts.HEIGHT_INVALID}</div>
        <div><span style={{ color: '#a855f7' }}>■</span> Source ID conflicts, duplicates or unknown: {counts.SOURCE_ID_CONFLICT + counts.DUPLICATE_SOURCE_ID + counts.SOURCE_ID_UNAVAILABLE}</div>
        {selected && <div role="status">{selected}</div>}
      </div>}
      <p style={{ marginBottom: 0, fontSize: 11 }}>
        Source: TSM published Posey screening GeoJSON. Imported geometries are unchanged;
        no missing buildings are synthesized. Not a 3D Tiles audit, certified geometry,
        observed roof elevation, or parcel flood-risk determination.
      </p>
    </details>
  );
}
