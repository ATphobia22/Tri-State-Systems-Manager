/**
 * berm-three-geometry.ts — trapezoidal berm/embankment prism geometry for
 * the MapLibre Three.js custom layer.
 *
 * Pure geometry math over REAL placement parameters: takes AlignmentStation[]
 * + TypicalSection from lib/engineering/berm-road-placement.ts and extrudes
 * the typical cross-section along the centerline into a THREE.BufferGeometry.
 *
 * Local frame (meters, Y-up — matches the MapLibreThreeLayer scene
 * convention): X = distance along the alignment, Y = elevation, Z = lateral
 * offset. Feet are converted to meters (×0.3048) because the layer scales
 * the scene with meterInMercatorCoordinateUnits().
 *
 * Geographic placement (alignment origin lng/lat, bearing) is NOT handled
 * here — it belongs to the caller, which must supply surveyed or
 * operator-confirmed values. This module never invents coordinates.
 *
 * Fail-closed: every export returns null (or adds nothing) on invalid
 * input instead of producing degenerate geometry. Nothing here throws.
 */

import * as THREE from 'three';
import type {
  AlignmentStation,
  TypicalSection,
} from './engineering/berm-road-placement';

/** Feet → meters. */
export const FT_TO_M = 0.3048;

/**
 * Shared earthwork PBR material parameters: compacted-earth tones, fully
 * rough, non-metallic. Views should construct their own material from
 * these so the berm reads consistently everywhere it is shown.
 */
export const BERM_MATERIAL_PARAMS = {
  color: 0x8a7a5c,
  roughness: 1.0,
  metalness: 0.0,
} as const;

function isValidSection(section: TypicalSection): boolean {
  return (
    Number.isFinite(section.crestWidthFt) &&
    Number.isFinite(section.crestElevFt) &&
    Number.isFinite(section.sideSlopeHV) &&
    Number.isFinite(section.dredgeFillFraction) &&
    section.crestWidthFt > 0 &&
    section.sideSlopeHV > 0 &&
    section.dredgeFillFraction >= 0 &&
    section.dredgeFillFraction <= 1
  );
}

function isValidStations(stations: AlignmentStation[]): boolean {
  if (!Array.isArray(stations) || stations.length < 2) return false;
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    if (
      !s ||
      !Number.isFinite(s.stationFt) ||
      !Number.isFinite(s.groundElevFt)
    ) {
      return false;
    }
    if (i > 0 && s.stationFt <= stations[i - 1].stationFt) return false;
  }
  return true;
}

/** Cross-section ring at one station, in meters: [toeL, crestL, crestR, toeR]. */
interface RingPoint {
  x: number;
  y: number;
  z: number;
}

function ringAt(
  station: AlignmentStation,
  section: TypicalSection,
): [RingPoint, RingPoint, RingPoint, RingPoint] {
  // Cut reaches (ground above crest) render flat — nothing is placed there.
  const topElevFt = Math.max(section.crestElevFt, station.groundElevFt);
  const fillHft = topElevFt - station.groundElevFt;
  const crestHalfFt = section.crestWidthFt / 2;
  const toeHalfFt = crestHalfFt + section.sideSlopeHV * fillHft;
  const x = station.stationFt * FT_TO_M;
  const yTop = topElevFt * FT_TO_M;
  const yGround = station.groundElevFt * FT_TO_M;
  const zCrest = crestHalfFt * FT_TO_M;
  const zToe = toeHalfFt * FT_TO_M;
  return [
    { x, y: yGround, z: -zToe }, // toe left
    { x, y: yTop, z: -zCrest }, // crest left
    { x, y: yTop, z: zCrest }, // crest right
    { x, y: yGround, z: zToe }, // toe right
  ];
}

function pushTri(
  positions: number[],
  a: RingPoint,
  b: RingPoint,
  c: RingPoint,
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

/**
 * Build the fill prism as a non-indexed triangle soup with outward-facing
 * winding: left slope, crest top, right slope per segment, plus end caps.
 * The base is left open (it intersects the terrain).
 *
 * Returns null when the input is invalid (fail-closed).
 */
export function buildBermPrismGeometry(
  stations: AlignmentStation[],
  section: TypicalSection,
): THREE.BufferGeometry | null {
  if (!isValidStations(stations) || !isValidSection(section)) return null;

  const positions: number[] = [];
  const rings = stations.map((s) => ringAt(s, section));

  for (let i = 0; i < rings.length - 1; i++) {
    const [a0, b0, c0, d0] = rings[i];
    const [a1, b1, c1, d1] = rings[i + 1];
    // Left slope (outward −Z).
    pushTri(positions, a0, b0, a1);
    pushTri(positions, b0, b1, a1);
    // Crest top (outward +Y).
    pushTri(positions, b0, c0, b1);
    pushTri(positions, c0, c1, b1);
    // Right slope (outward +Z).
    pushTri(positions, c0, d0, d1);
    pushTri(positions, c0, d1, c1);
  }

  // End caps.
  const [fa, fb, fc, fd] = rings[0];
  pushTri(positions, fa, fd, fc); // station 0, outward −X
  pushTri(positions, fa, fc, fb);
  const [la, lb, lc, ld] = rings[rings.length - 1];
  pushTri(positions, la, lc, ld); // last station, outward +X
  pushTri(positions, la, lb, lc);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.computeVertexNormals(); // flat facets on the non-indexed soup
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * Build a render-ready Mesh with the shared earthwork PBR material.
 * Returns null on invalid input (fail-closed).
 */
export function createBermMesh(
  stations: AlignmentStation[],
  section: TypicalSection,
): THREE.Mesh | null {
  const geometry = buildBermPrismGeometry(stations, section);
  if (!geometry) return null;
  const material = new THREE.MeshStandardMaterial({
    color: BERM_MATERIAL_PARAMS.color,
    roughness: BERM_MATERIAL_PARAMS.roughness,
    metalness: BERM_MATERIAL_PARAMS.metalness,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * MapLibreThreeLayer content-builder factory. Adds the berm mesh to the
 * scene when the parameters are valid; adds nothing otherwise. Never throws
 * (a throwing builder must not break the map render loop).
 */
export function bermSceneContent(
  stations: AlignmentStation[],
  section: TypicalSection,
): (scene: THREE.Scene) => void {
  return (scene: THREE.Scene) => {
    try {
      const mesh = createBermMesh(stations, section);
      if (mesh) scene.add(mesh);
    } catch {
      /* fail-closed: leave the scene untouched */
    }
  };
}
