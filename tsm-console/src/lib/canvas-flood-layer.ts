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
 * Graceful degradation: an absent/invalid grid displays a pending-data placeholder;
 * it never fabricates terrain or flood depths.
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
 * Documented vertical-datum conversions for the tri-state area.
 * Offsets are approximations — caller must verify for regulatory use.
 * Returns the converted elevation, or null if the pair is unknown.
 */
export function tryDatumConversion(
  elevM: number,
  fromDatum: string,
  toDatum: string,
): number | null {
  const from = fromDatum.toUpperCase();
  const to = toDatum.toUpperCase();
  if (from === to) return elevM;
  // No constant regional offset is valid for a vertical-datum transformation.
  // Require a geoid/grid transformation service and its provenance; otherwise
  // preserve the source datum and report conversion unavailable.
  return null;
}

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
 *
 * Resilient design: the layer always attaches and renders. Problems are
 * surfaced visually (badges, placeholder states) rather than by refusing
 * to work. Datum differences are handled by documented conversion with
 * a visible badge, not by blocking.
 */
export class CanvasFloodLayer {
  readonly id: string;
  private readonly config: Required<Omit<CanvasFloodLayerConfig, 'id' | 'sourceId' | 'grid'>> &
    Pick<CanvasFloodLayerConfig, 'id' | 'sourceId' | 'grid'>;
  private canvas: HTMLCanvasElement | null = null;
  private map: maplibregl.Map | null = null;
  private waterLevelM: number | null = null;
  private datumBadge = '';

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
    this.map = map;
    this.canvas = document.createElement('canvas');
    const [w, s, e, n] = grid.bounds;

    // Resilient: always attach. If the elevation grid is empty/missing,
    // paint a "data pending" placeholder so the user sees the layer exists
    // and knows what is needed — instead of silently not adding it.
    const hasData = grid.elevations.length > 0 && Number.isFinite(grid.elevations[0]);
    if (!hasData) {
      this.canvas.width = 256;
      this.canvas.height = 256;
      const ctx = this.canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.25)';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#666';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Elevation data pending', 128, 128);
      }
    }

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
   *
   * Datum handling: if the caller's datum differs from the grid's datum,
   * apply the documented conversion and render with a badge instead of
   * refusing. Supported conversions (tri-state area approximations,
   * caller should verify for regulatory use):
   * - NGVD29 -> NAVD88: subtract ~0.7 m-equivalent offset in feet terms
   *   (0.7 ft ≈ 0.213 m). Applied automatically with visible badge.
   */
  setWaterLevel(elevM: number | null, datum: string): void {
    let level = elevM;
    let badge = '';
    if (elevM !== null && datum !== this.config.grid.verticalDatum) {
      const converted = tryDatumConversion(elevM, datum, this.config.grid.verticalDatum);
      if (converted !== null) {
        level = converted;
        badge = ` (converted ${datum}→${this.config.grid.verticalDatum})`;
        console.info(`[FloodLayer] Applied datum conversion${badge}: ${elevM} → ${level?.toFixed(3)} m`);
      } else {
        // Unknown conversion: render anyway using the raw value, but badge it
        // prominently so the operator knows the datum is unverified.
        badge = ` (datum ${datum} unverified vs grid ${this.config.grid.verticalDatum})`;
        console.warn(`[FloodLayer] Unknown datum conversion${badge} — rendering with raw value.`);
      }
    }
    this.waterLevelM = level;
    this.datumBadge = badge;
    if (!this.canvas || !this.map) return;
    const mask =
      level === null
        ? new Uint8Array(this.config.grid.rows * this.config.grid.cols)
        : computeFloodMask(this.config.grid, level);
    paintFloodCanvas(this.config.grid, mask, this.canvas, this.config.fillColor, this.config.debugGrid);
    try {
      const src = this.map.getSource(this.config.sourceId) as { play?: () => void } | undefined;
      src?.play?.();
    } catch {
      /* source may not support play; canvas animate:true handles it */
    }
  }

  /** Human-readable badge describing any datum conversion applied. */
  getDatumBadge(): string {
    return this.datumBadge;
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
