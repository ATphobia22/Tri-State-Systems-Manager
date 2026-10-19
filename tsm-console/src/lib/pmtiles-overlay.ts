import * as maplibregl from 'maplibre-gl';
import { createPmtilesProtocol, toPmtilesSourceUrl } from './pmtiles-fabric';

const SOURCE_ID = 'tsm-configured-pmtiles-polygons';
const FILL_LAYER_ID = 'tsm-configured-pmtiles-polygons-fill';
const LINE_LAYER_ID = 'tsm-configured-pmtiles-polygons-line';
let protocolRegistered = false;

function getConfiguredSource(): {
  archiveUrl: string;
  sourceLayer: string;
  attribution: string;
} | null {
  const archiveUrl = import.meta.env.VITE_TSM_PMTILES_URL?.trim();
  const sourceLayer = import.meta.env.VITE_TSM_PMTILES_SOURCE_LAYER?.trim();
  const attribution = import.meta.env.VITE_TSM_PMTILES_ATTRIBUTION?.trim();
  if (!archiveUrl || !sourceLayer || !attribution) return null;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sourceLayer)) return null;
  return { archiveUrl, sourceLayer, attribution };
}

function ensureProtocolRegistered(): void {
  if (protocolRegistered) return;
  const protocol = createPmtilesProtocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
}

/**
 * Attach a configured, static polygon vector archive. This is intentionally
 * disabled unless the archive URL, source-layer name, and attribution exist.
 * Archives are immutable; dynamic queries belong in the PostGIS RPC.
 */
export function attachConfiguredPmtilesPolygonLayer(map: maplibregl.Map): () => void {
  const configured = getConfiguredSource();
  if (!configured || map.getSource(SOURCE_ID)) return () => undefined;

  ensureProtocolRegistered();
  const url = toPmtilesSourceUrl({
    id: 'configured-static-polygons',
    archiveUrl: configured.archiveUrl,
    attribution: configured.attribution,
    enabled: true,
  });

  map.addSource(SOURCE_ID, {
    type: 'vector',
    url,
    attribution: configured.attribution,
  });
  map.addLayer({
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    'source-layer': configured.sourceLayer,
    paint: { 'fill-color': '#a78bfa', 'fill-opacity': 0.07 },
  });
  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    'source-layer': configured.sourceLayer,
    paint: { 'line-color': '#a78bfa', 'line-width': 1 },
  });

  return () => {
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };
}
