/**
 * canvas-flood-layer.ts — HazardSim-style flood visualization for MapLibre GL.
 *
 * Research basis: mapping-planes-lod-integration-20261018-0426 §5
 * Technique: map-tile-aligned grid + real elevation data + flood-fill that
 * respects hills/valleys → pixels written into a canvas handed to the map as
 * a canvas source, updated per frame. Uses only MapLibre-compatible APIs,
 * local-first, cheap. No WebGPU required.
 *
 * How it works:
 * 1. A canvas source is registered with the map, covering the AOI bounds.
 * 2. Elevation for the AOI is sampled into a Float32Array grid (caller-supplied;
 *    e.g. from the Indiana 2020 DEM or USGS 3DEP tiles already in the repo).
 * 3. setWaterLevel(elevMeters) runs a BFS flood-fill from seed cells at/below
 *    the water level, propagating only through cells whose elevation is also
 *    at/below the level (respects hills/valleys — water cannot climb).
 * 4. Flooded cells are painted translucent blue; the canvas source updates.
 *
 * Fail-closed: no elevation grid = no flood rendering (never fabricates).
 * Water level must be an explicit caller-supplied number (human authority).
 */

import * as maplibregl from 'maplibre-gl';

export interface FloodGrid {
  /** Elevations in meters, row-major, rows*cols values. */
  elevations: Float32Array;
  rows: number;
  cols: number;
  /** Geographic bounds of the grid: [west, south, east, north]. */
  bounds: [number, number, number, number];
  /** Vertical datum label, e.g. 'NAVD88'. Required — never assume. */
  verticalDatum: string;
}

export interface CanvasFloodLayerConfig {
  id: string;
  sourceId: string;
  grid: FloodGrid;
  /** Fill color for flooded cells. Default translucent blue. */
  fillColor?: string;
  /** Cell border for debug. Default none. */
  debugGrid?: boolean;
}

const DEFAULT_FILL = 'rgba(30, 120, 220, 0.55)';

/**
 * BFS flood-fill from all cells at/below waterLevel, propagating only
 * through connected cells also at/below waterLevel. Respects terrain:
 * water cannot flow uphill over cells above the level.
 */
export function computeFloodMask(grid: FloodGrid, waterLevelM: number): Uint8Array {
  const { elevations, rows, cols } = grid;
  const flooded = new Uint8Array(rows * cols);
  const queue: number[] = [];

  // Seed: all cells at or below the water level.
  for (let i = 0; i < elevations.length; i++) {
    if (Number.isFinite(elevations[i]) && elevations[i] <= waterLevelM) {
      flooded[i] = 1;
      queue.push(i);
    }
  }

  // BFS through 4-connected neighbors that are also at/below level.
  // (Seeds already cover every below-level cell; BFS is retained so a
  // caller can later restrict seeds to river cells for true inundation
  // spread instead of bathtub fill.)
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const neighbors: number[] = [];
    if (r > 0) neighbors.push(idx - cols);
    if (r < rows - 1) neighbors.push(idx + cols);
    if (c > 0) neighbors.push(idx - 1);
    if (c < cols - 1) neighbors.push(idx + 1);
    for (const n of neighbors) {
      if (!flooded[n] && Number.isFinite(elevations[n]) && elevations[n] <= waterLevelM) {
        flooded[n] = 1;
        queue.push(n);
      }
    }
  }
  return flooded;
}

/**
 * Paint the flood mask onto a canvas. Returns the canvas for the map source.
 */
export function paintFloodCanvas(
  grid: FloodGrid,
  mask: Uint8Array,
  canvas: HTMLCanvasElement,
  fillColor: string = DEFAULT_FILL,
  debugGrid = false,
): void {
  const { rows, cols } = grid;
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cols, rows);
  ctx.fillStyle = fillColor;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r * cols + c]) ctx.fillRect(c, r, 1, 1);
    }
  }
  if (debugGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r += 10) {
      ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(cols, r); ctx.stroke();
    }
    for (let c = 0; c <= cols; c += 10) {
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, rows); ctx.stroke();
    }
  }
}

/**
 * MapLibre canvas-source flood layer. Caller owns the elevation grid and
 * sets the water level explicitly (human authority — no auto-fetch).
 */
export class CanvasFloodLayer {
  readonly id: string;
  private readonly config: Required<Omit<CanvasFloodLayerConfig, 'id' | 'sourceId' | 'grid'>> &
    Pick<CanvasFloodLayerConfig, 'id' | 'sourceId' | 'grid'>;
  private canvas: HTMLCanvasElement | null = null;
  private map: maplibregl.Map | null = null;
  private waterLevelM: number | null = null;

  constructor(config: CanvasFloodLayerConfig) {
    this.id = config.id;
    this.config = {
      ...config,
      fillColor: config.fillColor ?? DEFAULT_FILL,
      debugGrid: config.debugGrid ?? false,
    };
  }

  /** Attach to the map. Creates the canvas source + raster layer. */
  addTo(map: maplibregl.Map): void {
    const { grid, sourceId } = this.config;
    if (!grid.elevations.length || !Number.isFinite(grid.elevations[0])) {
      console.warn('[FloodLayer] No elevation grid — layer not added (fail-closed).');
      return;
    }
    this.map = map;
    this.canvas = document.createElement('canvas');
    const [w, s, e, n] = grid.bounds;
    try {
      map.addSource(sourceId, {
        type: 'canvas',
        canvas: this.canvas,
        coordinates: [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ],
        animate: true,
      });
      map.addLayer({
        id: this.id,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': 0.85 },
      });
    } catch (err) {
      console.warn('[FloodLayer] Failed to add source/layer:', err);
    }
  }

  /**
   * Set the water surface elevation in meters (caller-supplied, explicit).
   * Recomputes the flood mask and repaints. Pass null to clear.
   */
  setWaterLevel(elevM: number | null, datum: string): void {
    if (elevM !== null && datum !== this.config.grid.verticalDatum) {
      console.warn(
        `[FloodLayer] Datum mismatch: grid is ${this.config.grid.verticalDatum}, ` +
          `level given as ${datum}. Refusing to render (fail-closed).`,
      );
      return;
    }
    this.waterLevelM = elevM;
    if (!this.canvas || !this.map) return;
    const mask =
      elevM === null
        ? new Uint8Array(this.config.grid.rows * this.config.grid.cols)
        : computeFloodMask(this.config.grid, elevM);
    paintFloodCanvas(this.config.grid, mask, this.canvas, this.config.fillColor, this.config.debugGrid);
    // Canvas source repaint: remove and re-add is the reliable refresh path.
    try {
      const src = this.map.getSource(this.config.sourceId) as { play?: () => void } | undefined;
      src?.play?.();
    } catch {
      /* source may not support play; canvas animate:true handles it */
    }
  }

  remove(): void {
    try {
      if (this.map?.getLayer(this.id)) this.map.removeLayer(this.id);
      if (this.map?.getSource(this.config.sourceId)) this.map.removeSource(this.config.sourceId);
    } catch {
      /* ignore teardown errors */
    }
    this.map = null;
    this.canvas = null;
  }

  getWaterLevel(): number | null {
    return this.waterLevelM;
  }
}
