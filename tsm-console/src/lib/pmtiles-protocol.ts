/**
 * PMTiles protocol integration for MapLibre GL.
 * 
 * PMTiles is a single-file tile archive format that supports HTTP range requests.
 * This allows the console to load vector tiles directly from a .pmtiles file
 * hosted on any static server (GitHub Pages, USB, local file) without a tile server.
 * 
 * Usage:
 *   import { registerPMTilesProtocol } from './pmtiles-protocol';
 *   registerPMTilesProtocol();
 *   
 *   // Then in map style:
 *   // sources: { buildings: { type: 'vector', url: 'pmtiles:///data/tristate-buildings.pmtiles' } }
 * 
 * For the tri-state area (8 counties), extract from Overture:
 *   pmtiles extract https://overturemaps-extras-us-west-2.s3.amazonaws.com/tiles/2026-09-23.1/buildings.pmtiles tristate-buildings.pmtiles --bbox=-88.7,37.6,-87.2,38.5
 */

import * as pmtiles from 'pmtiles';

let protocolRegistered = false;

/**
 * Register the pmtiles:// protocol with MapLibre GL.
 * Safe to call multiple times - only registers once.
 */
export function registerPMTilesProtocol(): void {
  if (protocolRegistered) return;
  
  const protocol = new pmtiles.Protocol();
  
  // MapLibre GL v3+ uses addProtocol
  if (typeof (window as any) !== 'undefined') {
    import('maplibre-gl').then((maplibregl) => {
      maplibregl.addProtocol('pmtiles', protocol.tile);
      protocolRegistered = true;
    });
  }
}

/**
 * Tri-state bounding box covering all 8 counties:
 * IN: Posey, Vanderburgh, Gibson, Warrick
 * IL: Gallatin, White  
 * KY: Henderson, Union
 */
export const TRI_STATE_BBOX: [number, number, number, number] = [-88.7, 37.6, -87.2, 38.5];

/**
 * Expected PMTiles files for the tri-state area.
 * Place these in tsm-console/public/data/pmtiles/
 */
export const TRISTATE_PMTILES = {
  buildings: 'pmtiles:///data/pmtiles/tristate-buildings.pmtiles',
  // Future: terrain, parcels, etc.
} as const;
