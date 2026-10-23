/**
 * canvas-flood-layer.ts — HazardSim-style flood visualization for MapLibre GL.
 *
 * Resilient: no elevation grid = no flood rendering (never fabricates).
 * Water level must be an explicit caller-supplied number (human authority).
 * Vertical datum: identity conversion only. Unknown pairs return null —
 * never substitute a constant regional offset without published evidence.
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
 * Vertical-datum conversion.
 * Only identity is supported without published geoid/evidence parameters.
 * Returns null for unknown pairs or non-finite elevation — never invents offsets.
 */
export function tryDatumConversion(
  elevM: number,
  fromDatum: string,
  toDatum: string,
): number | null {
  if (!Number.isFinite(elevM)) return null;
  const from = fromDatum.toUpperCase().trim();
  const to = toDatum.toUpperCase().trim();
  if (!from || !to) return null;
  if (from === to) return elevM;
  // No constant NGVD29↔NAVD88 substitution: regional offsets vary and require
  // published station/geoid evidence (human authority remains final).
  return null;
}

/**
 * BFS flood-fill from all cells at/below waterLevel, propagating only
 * through connected cells also at/below waterLevel.
 * Returns empty mask when grid is malformed or water level is non-finite.
 */
export function computeFloodMask(grid: FloodGrid, waterLevelM: number): Uint8Array {
  const { elevations, rows, cols } = grid;
  if (
    !Number.isFinite(waterLevelM) ||
    rows <= 0 ||
    cols <= 0 ||
    elevations.length !== rows * cols
  ) {
    return new Uint8Array(0);
  }

  const flooded = new Uint8Array(rows * cols);
  const queue: number[] = [];

  for (let i = 0; i < elevations.length; i++) {
    if (Number.isFinite(elevations[i]) && elevations[i] <= waterLevelM) {
      flooded[i] = 1;
      queue.push(i);
    }
  }

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
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.lineTo(cols, r);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c += 10) {
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, rows);
      ctx.stroke();
    }
  }
}

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

  addTo(map: maplibregl.Map): void {
    const { grid, sourceId } = this.config;
    this.map = map;
    this.canvas = document.createElement('canvas');
    const [w, s, e, n] = grid.bounds;

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

  setWaterLevel(elevM: number | null, datum: string): void {
    let level = elevM;
    let badge = '';
    if (elevM !== null && datum !== this.config.grid.verticalDatum) {
      const converted = tryDatumConversion(elevM, datum, this.config.grid.verticalDatum);
      if (converted !== null) {
        level = converted;
        badge = ` (converted ${datum}→${this.config.grid.verticalDatum})`;
      } else {
        badge = ` (datum ${datum} unverified vs grid ${this.config.grid.verticalDatum})`;
        console.warn(`[FloodLayer] Unknown datum conversion${badge} — no constant offset applied.`);
      }
    }
    this.waterLevelM = level;
    this.datumBadge = badge;
    if (!this.canvas || !this.map) return;
    const mask =
      level === null || !Number.isFinite(level)
        ? new Uint8Array(0)
        : computeFloodMask(this.config.grid, level);
    if (mask.length === 0) {
      const ctx = this.canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    paintFloodCanvas(this.config.grid, mask, this.canvas, this.config.fillColor, this.config.debugGrid);
    try {
      const src = this.map.getSource(this.config.sourceId) as { play?: () => void } | undefined;
      src?.play?.();
    } catch {
      /* ignore */
    }
  }

  getDatumBadge(): string {
    return this.datumBadge;
  }

  remove(): void {
    try {
      if (this.map?.getLayer(this.id)) this.map.removeLayer(this.id);
      if (this.map?.getSource(this.config.sourceId)) this.map.removeSource(this.config.sourceId);
    } catch {
      /* ignore */
    }
    this.map = null;
    this.canvas = null;
  }

  getWaterLevel(): number | null {
    return this.waterLevelM;
  }
}
