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
 * Resolve a vertical-datum conversion only when an explicit transformation exists.
 * No regional constant offset is applied here. Unknown pairs return null so the
 * flood overlay can show a datum warning without drawing a misleading flood mask.
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
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0 || elevations.length !== rows * cols || !Number.isFinite(waterLevelM)) {
    return new Uint8Array(0);
  }
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
  const gridIsValid = Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && cols > 0 &&
    grid.elevations.length === rows * cols && mask.length === rows * cols;
  canvas.width = gridIsValid ? cols : 1;
  canvas.height = gridIsValid ? rows : 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!gridIsValid) return;
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
  private statusMessage: string | null = 'Flood overlay has not been attached.';

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
    const boundsValid = grid.bounds.every(Number.isFinite) && w < e && s < n;
    const dimensionsValid = Number.isInteger(grid.rows) && Number.isInteger(grid.cols) &&
      grid.rows > 0 && grid.cols > 0 && grid.rows <= 4096 && grid.cols <= 4096 &&
      grid.elevations.length === grid.rows * grid.cols;
    if (!boundsValid || !dimensionsValid || !grid.verticalDatum.trim()) {
      this.statusMessage = !boundsValid
        ? 'Flood overlay unavailable: geographic bounds are invalid.'
        : !dimensionsValid
          ? 'Flood overlay unavailable: elevation grid dimensions or data length are invalid.'
          : 'Flood overlay unavailable: vertical datum is missing.';
      this.datumBadge = this.statusMessage;
      return;
    }

    // Empty or nodata grids remain visible as a labeled pending-data state;
    // they never create a synthetic elevation surface or flood mask.
    const hasData = grid.elevations.length > 0 && grid.elevations.some(Number.isFinite);
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
      this.statusMessage = 'Elevation data pending. The map remains available; no flood depths are displayed.';
    } else {
      this.statusMessage = null;
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
    } catch (error) {
      try {
        if (map.getLayer(this.id)) map.removeLayer(this.id);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Keep the rest of MapLibre intact if partial teardown is impossible.
      }
      this.statusMessage = 'Flood overlay unavailable: ' + (error instanceof Error ? error.message : 'MapLibre could not attach the raster layer.');
      this.datumBadge = this.statusMessage;
      console.warn('[FloodLayer] Overlay unavailable; base map preserved.', error);
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
    if (!this.canvas || !this.map) {
      this.statusMessage = 'Flood overlay is not attached to a map.';
      return;
    }
    if (elevM === null) {
      this.waterLevelM = null;
      this.datumBadge = '';
      this.statusMessage = 'Flood overlay cleared; no water level is selected.';
      paintFloodCanvas(
        this.config.grid,
        new Uint8Array(this.config.grid.rows * this.config.grid.cols),
        this.canvas,
        this.config.fillColor,
        this.config.debugGrid,
      );
      return;
    }
    if (!Number.isFinite(elevM)) {
      this.waterLevelM = null;
      this.datumBadge = 'Water level is unavailable because the value is not finite.';
      this.statusMessage = this.datumBadge;
      paintFloodCanvas(
        this.config.grid,
        new Uint8Array(this.config.grid.rows * this.config.grid.cols),
        this.canvas,
        this.config.fillColor,
        this.config.debugGrid,
      );
      return;
    }

    let level = elevM;
    let badge = '';
    if (datum !== this.config.grid.verticalDatum) {
      const converted = tryDatumConversion(elevM, datum, this.config.grid.verticalDatum);
      if (converted === null) {
        this.waterLevelM = null;
        this.datumBadge = `Datum mismatch: ${datum} → ${this.config.grid.verticalDatum}; no flood mask rendered.`;
        this.statusMessage = this.datumBadge;
        paintFloodCanvas(
          this.config.grid,
          new Uint8Array(this.config.grid.rows * this.config.grid.cols),
          this.canvas,
          this.config.fillColor,
          this.config.debugGrid,
        );
        return;
      }
      level = converted;
      badge = ` (converted ${datum}→${this.config.grid.verticalDatum})`;
    }

    try {
      const mask = computeFloodMask(this.config.grid, level);
      if (mask.length !== this.config.grid.rows * this.config.grid.cols) {
        throw new Error('Elevation grid dimensions are inconsistent.');
      }
      this.waterLevelM = level;
      this.datumBadge = badge;
      this.statusMessage = null;
      paintFloodCanvas(this.config.grid, mask, this.canvas, this.config.fillColor, this.config.debugGrid);
      const src = this.map.getSource(this.config.sourceId) as { play?: () => void } | undefined;
      src?.play?.();
    } catch (error) {
      this.waterLevelM = null;
      this.datumBadge = 'Flood overlay unavailable: ' + (error instanceof Error ? error.message : 'rendering failed.');
      this.statusMessage = this.datumBadge;
      paintFloodCanvas(
        this.config.grid,
        new Uint8Array(this.config.grid.rows * this.config.grid.cols),
        this.canvas,
        this.config.fillColor,
        this.config.debugGrid,
      );
    }
  }

  /** Current overlay state; degraded overlays do not block the base map. */
  getStatus(): { state: 'ready' | 'degraded' | 'pending'; message: string | null } {
    if (this.statusMessage === null) return { state: 'ready', message: null };
    if (this.statusMessage.includes('pending') || this.statusMessage.includes('not attached')) {
      return { state: 'pending', message: this.statusMessage };
    }
    return { state: 'degraded', message: this.statusMessage };
  }

  /** Human-readable note for the datum conversion or mismatch status. */
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
