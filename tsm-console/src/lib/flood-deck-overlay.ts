/**
 * flood-deck-overlay.ts — deck.gl inundation overlay for the TSM digital twin.
 *
 * WHAT THIS IS
 * ------------
 * A visualization adapter. It takes the depth grid produced by the EXISTING
 * diffusion-wave screening model (`runScenario` in scenario-runner.ts, which
 * wraps `runDiffusionWave` in hydraulics-diffusion2d.ts) and renders it on the
 * MapLibre plane as deck.gl layers. It performs NO hydrology and NO hydraulics
 * of its own: every number on screen comes from the screening model.
 *
 * WHAT THIS IS NOT
 * ----------------
 * - Not a flood model. Not calibrated, not validated against observed events.
 * - Not a regulatory product. NOT a FEMA determination, NOT an NFHL product,
 *   NOT a no-rise analysis, NOT an Elevation Certificate, NOT a LOMA.
 * - The demo scenario builder below uses SYNTHETIC ILLUSTRATIVE TERRAIN — a
 *   smooth idealized valley, not a DEM of any real place. It exists so a
 *   reviewer can see the overlay pipeline end to end without real survey data.
 *   Never present its depths as site conditions.
 *
 * RENDERING
 * ---------
 * deck.gl 9.4 (MIT, no token) via @deck.gl/maplibre MapLibreOverlay, WebGL2
 * path only. Two layers provide REDUNDANT depth encoding so color is never the
 * only channel (accessibility): a stepped-class BitmapLayer heatmap plus a
 * ContourLayer with isolines at the same class breaks.
 *
 * LAYER METADATA carries the screening disclaimer; the overlay is OFF by
 * default and is only ever enabled by an explicit user toggle.
 */

import { MapLibreOverlay } from '@deck.gl/maplibre';
import { BitmapLayer, ContourLayer } from 'deck.gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { runScenario, type ScenarioDefinition, type ScenarioResult } from './scenario-runner';

export const FLOOD_OVERLAY_DISCLAIMER =
  'Screening-level inundation — NOT a regulatory determination. ' +
  'Uncalibrated diffusion-wave screening model; illustrative unless driven by verified site inputs.';

export const FLOOD_OVERLAY_ID = 'tsm-flood-screening-overlay';

/** Depth class breaks in feet — shared by the color ramp and the contour lines. */
export const DEPTH_CLASS_BREAKS_FT = [0.5, 2, 5] as const;

/** RGBA color for one depth class. Alpha also steps with depth (redundant encoding). */
export type RgbaColor = [number, number, number, number];

/**
 * Stepped depth -> color mapping. Pure function, fully unit-testable.
 * Dry cells are fully transparent. Each class has a distinct hue step AND a
 * distinct opacity step, so depth is readable even in grayscale.
 */
export function depthToColorFt(depthFt: number): RgbaColor {
  if (!Number.isFinite(depthFt) || depthFt <= 0) return [0, 0, 0, 0];
  if (depthFt <= DEPTH_CLASS_BREAKS_FT[0]) return [147, 197, 253, 110]; // 0–0.5 ft: pale blue
  if (depthFt <= DEPTH_CLASS_BREAKS_FT[1]) return [59, 130, 246, 145]; // 0.5–2 ft: blue
  if (depthFt <= DEPTH_CLASS_BREAKS_FT[2]) return [29, 78, 216, 175]; // 2–5 ft: strong blue
  return [30, 27, 150, 200]; // >5 ft: deep indigo
}

/** Geographic bounds for a rectilinear screening grid. */
export interface FloodGridBounds {
  westLng: number;
  southLat: number;
  eastLng: number;
  northLat: number;
}

/** A depth grid plus the bounds it covers. Bounds are REQUIRED — fail-closed. */
export interface FloodGridInput {
  depthFt: number[][];
  nx: number;
  ny: number;
  bounds: FloodGridBounds;
}

function fail(message: string): never {
  throw new Error(`[flood-deck-overlay] ${message}`);
}

function validateGrid(input: FloodGridInput): void {
  const { depthFt, nx, ny, bounds } = input;
  if (!Number.isInteger(nx) || nx <= 0 || !Number.isInteger(ny) || ny <= 0) {
    fail(`nx/ny must be positive integers (got ${String(nx)}/${String(ny)}).`);
  }
  if (!Array.isArray(depthFt) || depthFt.length !== ny) {
    fail(`depthFt must have exactly ny=${ny} rows.`);
  }
  for (let j = 0; j < ny; j += 1) {
    const row = depthFt[j];
    if (!Array.isArray(row) || row.length !== nx) fail(`depthFt row ${j} must have nx=${nx} columns.`);
    for (let i = 0; i < nx; i += 1) {
      if (typeof row[i] !== 'number' || !Number.isFinite(row[i])) {
        fail(`depthFt[${j}][${i}] must be a finite number.`);
      }
    }
  }
  const b = bounds;
  for (const [k, v] of Object.entries(b) as Array<[string, number]>) {
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(`bounds.${k} must be a finite number.`);
  }
  if (!(b.westLng < b.eastLng && b.southLat < b.northLat)) {
    fail('bounds must satisfy westLng < eastLng and southLat < northLat.');
  }
}

/**
 * Paint the depth grid to an offscreen canvas using the stepped class ramp.
 * One canvas pixel per grid cell; BitmapLayer stretches it over the bounds.
 */
export function renderDepthCanvas(input: FloodGridInput): HTMLCanvasElement {
  validateGrid(input);
  const canvas = document.createElement('canvas');
  canvas.width = input.nx;
  canvas.height = input.ny;
  const ctx = canvas.getContext('2d');
  if (!ctx) fail('2d canvas context unavailable.');
  for (let j = 0; j < input.ny; j += 1) {
    for (let i = 0; i < input.nx; i += 1) {
      const [r, g, b, a] = depthToColorFt(input.depthFt[j][i]);
      ctx.fillStyle = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
      // Canvas row 0 is the top; grid row 0 is the south edge — flip vertically.
      ctx.fillRect(i, input.ny - 1 - j, 1, 1);
    }
  }
  return canvas;
}

/** Cell-center points for the contour layer (redundant depth encoding). */
export function gridCellCenters(input: FloodGridInput): Array<{ position: [number, number]; depthFt: number }> {
  validateGrid(input);
  const { westLng, southLat, eastLng, northLat } = input.bounds;
  const dx = (eastLng - westLng) / input.nx;
  const dy = (northLat - southLat) / input.ny;
  const centers: Array<{ position: [number, number]; depthFt: number }> = [];
  for (let j = 0; j < input.ny; j += 1) {
    for (let i = 0; i < input.nx; i += 1) {
      const depth = input.depthFt[j][i];
      if (depth > 0) {
        centers.push({ position: [westLng + (i + 0.5) * dx, southLat + (j + 0.5) * dy], depthFt: depth });
      }
    }
  }
  return centers;
}

export interface FloodDeckOverlayOptions {
  /** Cell size in meters, for contour smoothing. Defaults to 36.6 m (120 ft). */
  cellSizeMeters?: number;
}

/**
 * Toggleable deck.gl overlay. Off by default; call setVisible(true) only from
 * an explicit user action. Owns a single MapLibreOverlay control.
 */
export class FloodDeckOverlay {
  private overlay: MapLibreOverlay;
  private map: MapLibreMap;
  private grid: FloodGridInput | null = null;
  private visible = false;
  private cellSizeMeters: number;
  private attached = false;

  constructor(map: MapLibreMap, options: FloodDeckOverlayOptions = {}) {
    this.map = map;
    this.cellSizeMeters = options.cellSizeMeters ?? 120 * 0.3048;
    this.overlay = new MapLibreOverlay({ interleaved: true, layers: [] });
  }

  /** Attach the overlay control to the map. Idempotent. */
  attach(): void {
    if (this.attached) return;
    this.map.addControl(this.overlay);
    this.attached = true;
  }

  /** Supply (or replace) the inundation grid to render. Does not show it. */
  setInundation(grid: FloodGridInput): void {
    validateGrid(grid);
    this.grid = grid;
    this.refresh();
  }

  /** Show/hide. The map component must call this only from a user toggle. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.attach();
    this.refresh();
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Remove the control from the map. */
  dispose(): void {
    if (this.attached) {
      this.map.removeControl(this.overlay);
      this.attached = false;
    }
    this.grid = null;
    this.visible = false;
  }

  private refresh(): void {
    if (!this.visible || !this.grid) {
      this.overlay.setProps({ layers: [] });
      return;
    }
    const grid = this.grid;
    const b = grid.bounds;
    const heatmap = new BitmapLayer({
      id: `${FLOOD_OVERLAY_ID}-heatmap`,
      image: renderDepthCanvas(grid),
      bounds: [b.westLng, b.southLat, b.eastLng, b.northLat],
      opacity: 0.9,
      pickable: false,
    });
    const contours = new ContourLayer({
      id: `${FLOOD_OVERLAY_ID}-contours`,
      data: gridCellCenters(grid),
      getPosition: (d: { position: [number, number] }) => d.position,
      getWeight: (d: { depthFt: number }) => d.depthFt,
      cellSize: this.cellSizeMeters,
      contours: DEPTH_CLASS_BREAKS_FT.map((threshold) => ({
        threshold,
        color: [255, 255, 255, 220] as RgbaColor,
        strokeWidth: 2,
      })),
      pickable: false,
    });
    this.overlay.setProps({ layers: [heatmap, contours] });
  }
}

/** Layer-catalog metadata for the overlay (sidebar/legend use). */
export const FLOOD_OVERLAY_METADATA = {
  id: FLOOD_OVERLAY_ID,
  title: 'Flood overlay (screening)',
  authority: 'TSM screening model — computational, NOT regulatory',
  disclaimer: FLOOD_OVERLAY_DISCLAIMER,
  defaultVisible: false,
} as const;

// ---------------------------------------------------------------------------
// Illustrative demo scenario
// ---------------------------------------------------------------------------

/**
 * Build a SMALL, clearly-labeled ILLUSTRATIVE screening scenario so a reviewer
 * can exercise the overlay pipeline without real survey data.
 *
 * Terrain is SYNTHETIC: an idealized parabolic valley (low along the central
 * meridian, rising to the sides) around the Point Township anchor. It is NOT a
 * DEM, NOT site terrain, and its depths are NOT site conditions. The scenario
 * name and provenance carry that label; the overlay disclaimer repeats it.
 */
export function buildIllustrativeScreeningScenario(
  centerLat = 37.845887,
  centerLng = -88.005075,
): { definition: ScenarioDefinition; bounds: FloodGridBounds } {
  const nx = 48;
  const ny = 48;
  const dxFt = 120;
  const manningN = 0.06;

  // Idealized valley: parabolic cross-section, gentle downstream fall to the south.
  const elevationFt: number[][] = [];
  for (let j = 0; j < ny; j += 1) {
    const row: number[] = [];
    for (let i = 0; i < nx; i += 1) {
      const cross = (i / (nx - 1)) * 2 - 1; // -1 .. 1 across the valley
      const along = j / (ny - 1); // 0 north .. 1 south
      row.push(376 + 9 * cross * cross - 2.5 * along);
    }
    elevationFt.push(row);
  }

  const definition: ScenarioDefinition = {
    name: 'ILLUSTRATIVE screening demo — synthetic valley terrain, NOT site conditions',
    rainfall: {
      timeHrs: [0, 4],
      intensityInPerHr: [2, 2],
      curveNumber: 82,
      watershedAreaSqMi: 1.0,
    },
    grid: { nx, ny, dxFt, elevationFt, manningN },
    durationHrs: 4,
    // dt=2 s verified stable for this configuration (2026-10-06 sweep);
    // the model still fail-closes if its own CFL check trips.
    dtSec: 2,
    alertThresholds: {},
  };

  // Equirectangular bounds for a ~1.1 mi tile — adequate for a screening demo
  // at this latitude; NOT a geodetic projection for engineering use.
  const widthFt = nx * dxFt;
  const heightFt = ny * dxFt;
  const ftPerDegLat = 364000;
  const ftPerDegLng = 364000 * Math.cos((centerLat * Math.PI) / 180);
  const bounds: FloodGridBounds = {
    westLng: centerLng - widthFt / 2 / ftPerDegLng,
    eastLng: centerLng + widthFt / 2 / ftPerDegLng,
    southLat: centerLat - heightFt / 2 / ftPerDegLat,
    northLat: centerLat + heightFt / 2 / ftPerDegLat,
  };
  return { definition, bounds };
}

/** Run the illustrative scenario through the real screening chain. */
export function runIllustrativeScreeningScenario(
  centerLat = 37.845887,
  centerLng = -88.005075,
): { result: ScenarioResult; bounds: FloodGridBounds } {
  const { definition, bounds } = buildIllustrativeScreeningScenario(centerLat, centerLng);
  const result = runScenario(definition);
  return { result, bounds };
}
