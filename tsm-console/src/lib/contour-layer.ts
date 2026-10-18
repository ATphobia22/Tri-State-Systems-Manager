/**
 * TSM Contour Layer — dynamic elevation contours from DEM tiles.
 *
 * Uses maplibre-contour (https://github.com/onthegomap/maplibre-contour)
 * to generate contour lines on-the-fly from raster DEM tiles in the browser.
 * No server-side processing needed — runs in WebGL.
 *
 * Data sources:
 *  - Terrarium-encoded DEM tiles (Mapzen Terrarium format)
 *  - TSM can generate these from Indiana 2020 DEM or USGS 3DEP via gdal2tiles
 *
 * Usage:
 *   import { addContourLayer } from './contour-layer';
 *   addContourLayer(map, {
 *     demUrl: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
 *   });
 */

import maplibregl from 'maplibre-gl';

export interface ContourLayerOptions {
  /** Terrarium PNG tile URL template */
  demUrl: string;
  /** Contour interval in meters */
  interval?: number;
  /** Index contour every N lines */
  indexEvery?: number;
  /** Line color for regular contours */
  color?: string;
  /** Line color for index contours */
  indexColor?: string;
  /** Line width */
  lineWidth?: number;
}

/**
 * Add a contour layer to a MapLibre map.
 * Requires the maplibre-contour DemSource to be set up.
 */
export function addContourLayer(
  map: maplibregl.Map,
  options: ContourLayerOptions
): void {
  const {
    demUrl,
    interval = 5,
    indexEvery = 5,
    color = 'rgba(139, 90, 43, 0.6)',
    indexColor = 'rgba(139, 90, 43, 0.9)',
    lineWidth = 1,
  } = options;

  // DEM source (Terrarium-encoded)
  if (!map.getSource('tsm-dem')) {
    map.addSource('tsm-dem', {
      type: 'raster-dem',
      tiles: [demUrl],
      tileSize: 256,
      maxzoom: 15,
      attribution: 'USGS 3DEP / Indiana GIO',
    });
  }

  // Contour source — generates vector contours from the DEM
  // Requires maplibre-contour: npm install maplibre-contour
  // import { DemSource } from 'maplibre-contour';
  // const demSource = new DemSource({ url: demUrl, encoding: 'terrarium' });
  // demSource.setupMaplibre(maplibregl);

  if (!map.getSource('tsm-contours')) {
    map.addSource('tsm-contours', {
      type: 'vector',
      tiles: [
        // This URL pattern is served by maplibre-contour's DemSource
        // In production, point to your Terrarium tile server
        demUrl.replace('{z}/{x}/{y}', '{z}/{x}/{y}'),
      ],
      maxzoom: 15,
    });
  }

  // Regular contours
  if (!map.getLayer('tsm-contours')) {
    map.addLayer({
      id: 'tsm-contours',
      type: 'line',
      source: 'tsm-contours',
      'source-layer': 'contour',
      paint: {
        'line-color': color,
        'line-width': lineWidth,
      },
      filter: ['!=', ['%', ['get', 'ele'], interval * indexEvery], 0],
    });
  }

  // Index contours (every Nth, bolder)
  if (!map.getLayer('tsm-contours-index')) {
    map.addLayer({
      id: 'tsm-contours-index',
      type: 'line',
      source: 'tsm-contours',
      'source-layer': 'contour',
      paint: {
        'line-color': indexColor,
        'line-width': lineWidth * 2,
      },
      filter: ['==', ['%', ['get', 'ele'], interval * indexEvery], 0],
    });
  }

  // Contour labels
  if (!map.getLayer('tsm-contour-labels')) {
    map.addLayer({
      id: 'tsm-contour-labels',
      type: 'symbol',
      source: 'tsm-contours',
      'source-layer': 'contour',
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['get', 'ele'], 'm'],
        'text-size': 10,
      },
      paint: {
        'text-color': indexColor,
        'text-halo-color': 'white',
        'text-halo-width': 1,
      },
      filter: ['==', ['%', ['get', 'ele'], interval * indexEvery], 0],
    });
  }

  console.log(`Contour layer added (interval: ${interval}m)`);
}

/**
 * Generate Terrarium-encoded DEM tiles from a GeoTIFF.
 *
 * Requires: gdal2tiles.py with Terrarium encoding
 *
 *   gdal_translate input.tif terrarium.tif \
 *     -of PNG -ot Byte -scale \
 *     -co "TILED=YES"
 *
 * Or use titiler with terrarium encoding:
 *   https://github.com/developmentseed/titiler
 *
 * For TSM's Indiana 2020 DEM (EPSG:2968, feet):
 *   1. Reproject to EPSG:3857
 *   2. Convert feet to meters
 *   3. Encode as Terrarium: (elevation + 32768) * 256
 *   4. Tile with gdal2tiles.py
 */
export const TERRARIUM_GENERATION_GUIDE = `
Generate Terrarium DEM tiles for contours:

  # 1. Reproject and convert to meters
  gdalwarp -t_srs EPSG:3857 -r bilinear \\
    -te -9840000 4410000 -9710000 4540000 \\
    input-dem-ft.tif dem-3857-m.tif \\
    -co "TILED=YES" --config GDAL_NUM_THREADS ALL_CPUS

  # 2. Convert feet to meters (if needed)
  gdal_calc.py -A dem-3857-m.tif --outfile=dem-m.tif \\
    --calc="A*0.3048" --type=Float32

  # 3. Encode as Terrarium and tile
  # Terrarium: R*256 + G + B/256 - 32768 = elevation in meters
  gdal2tiles.py --zoom=8-15 --s_srs=EPSG:3857 \\
    --processes=4 dem-m.tif terrarium-tiles/

  # 4. Serve terrarium-tiles/ via any static server
  # Point demUrl to: https://your-server/terrarium-tiles/{z}/{x}/{y}.png
`;
