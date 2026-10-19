/**
 * Meshlet import for TSM.
 *
 * Production offline bake should use ATphobia22/nanite-webgpu (meshoptimizer WASM +
 * METIS DAG). This module provides:
 * 1. JSON/binary pack loader
 * 2. Portable greedy triangle clustering (no WASM) for CI + small pilot meshes
 *
 * Label authority SIMULATION_DEMO until evidence is attached.
 */

import {
  MESHLET_MAX_TRIANGLES,
  MESHLET_MAX_VERTICES,
  type MeshletDescriptor,
  type MeshletGeometry,
  type MeshletImportResult,
  type MeshletPack,
} from './meshlet-types';

export interface RawMeshInput {
  positions: Float32Array; // xyz
  indices: Uint32Array; // triangles
  normals?: Float32Array;
  sourceId: string;
  horizontalCrs?: string;
  verticalDatum?: string;
}

function triangleBounds(
  positions: Float32Array,
  indices: Uint32Array,
  triStart: number,
  triCount: number,
): { center: [number, number, number]; radius: number } {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = indices[triStart * 3 + t * 3 + k]! * 3;
      const x = positions[vi]!;
      const y = positions[vi + 1]!;
      const z = positions[vi + 2]!;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  let r = 0;
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = indices[triStart * 3 + t * 3 + k]! * 3;
      const dx = positions[vi]! - cx;
      const dy = positions[vi + 1]! - cy;
      const dz = positions[vi + 2]! - cz;
      r = Math.max(r, Math.hypot(dx, dy, dz));
    }
  }
  return { center: [cx, cy, cz], radius: r };
}

/**
 * Greedy sequential clustering into meshlets (portable, not METIS quality).
 * Use nanite-webgpu offline for production DAG simplification.
 */
export function buildMeshletsGreedy(input: RawMeshInput): MeshletImportResult {
  const warnings: string[] = [];
  const triCount = Math.floor(input.indices.length / 3);
  if (triCount === 0) {
    throw new Error('mesh has no triangles');
  }
  if (input.positions.length < 9) {
    throw new Error('mesh has insufficient positions');
  }

  const meshlets: MeshletDescriptor[] = [];
  let cursor = 0;
  while (cursor < triCount) {
    const remaining = triCount - cursor;
    const take = Math.min(MESHLET_MAX_TRIANGLES, remaining);
    // Approximate unique verts in window
    const vertSet = new Set<number>();
    for (let t = 0; t < take; t++) {
      for (let k = 0; k < 3; k++) {
        vertSet.add(input.indices[(cursor + t) * 3 + k]!);
      }
    }
    let actualTake = take;
    if (vertSet.size > MESHLET_MAX_VERTICES) {
      // shrink until under vertex budget
      actualTake = 0;
      vertSet.clear();
      for (let t = 0; t < take; t++) {
        const next = new Set(vertSet);
        for (let k = 0; k < 3; k++) next.add(input.indices[(cursor + t) * 3 + k]!);
        if (next.size > MESHLET_MAX_VERTICES) break;
        vertSet.clear();
        next.forEach((v) => vertSet.add(v));
        actualTake = t + 1;
      }
      if (actualTake === 0) actualTake = 1; // force progress
      warnings.push(`meshlet at tri ${cursor}: reduced to ${actualTake} tris for vertex budget`);
    }

    const bounds = triangleBounds(input.positions, input.indices, cursor, actualTake);
    meshlets.push({
      vertexOffset: 0,
      vertexCount: vertSet.size,
      triangleOffset: cursor,
      triangleCount: actualTake,
      bounds,
      lodError: 0,
      parentIndex: -1,
    });
    cursor += actualTake;
  }

  if (meshlets.length > 1) {
    warnings.push(
      'greedy clusters only — run ATphobia22/nanite-webgpu preprocess for LOD DAG + meshoptimizer quality',
    );
  }

  const geometry: MeshletGeometry = {
    positions: input.positions,
    indices: input.indices,
    normals: input.normals,
  };

  const pack: MeshletPack = {
    version: 1,
    authority: 'SIMULATION_DEMO',
    sourceId: input.sourceId,
    horizontalCrs: input.horizontalCrs ?? 'EPSG:4326',
    verticalDatum: input.verticalDatum ?? 'NAVD88',
    meshlets,
    geometry,
    contentSha256: null,
  };

  return {
    pack,
    meshletCount: meshlets.length,
    triangleCount: triCount,
    warnings,
  };
}

/** Load a JSON-serialized meshlet pack (arrays as number[]). */
export function importMeshletPackJson(json: unknown): MeshletImportResult {
  if (!json || typeof json !== 'object') throw new Error('invalid pack');
  const o = json as Record<string, unknown>;
  if (o.version !== 1) throw new Error('unsupported meshlet pack version');
  const geom = o.geometry as Record<string, unknown>;
  const positions = Float32Array.from(geom.positions as number[]);
  const indices = Uint32Array.from(geom.indices as number[]);
  const normals = geom.normals ? Float32Array.from(geom.normals as number[]) : undefined;
  const meshlets = (o.meshlets as MeshletDescriptor[]).map((m) => ({
    ...m,
    bounds: {
      center: m.bounds.center as [number, number, number],
      radius: m.bounds.radius,
    },
  }));

  const pack: MeshletPack = {
    version: 1,
    authority: (o.authority as MeshletPack['authority']) ?? 'SIMULATION_DEMO',
    sourceId: String(o.sourceId ?? 'unknown'),
    horizontalCrs: String(o.horizontalCrs ?? 'EPSG:4326'),
    verticalDatum: String(o.verticalDatum ?? 'NAVD88'),
    meshlets,
    geometry: { positions, indices, normals },
    contentSha256: (o.contentSha256 as string | null) ?? null,
  };

  const triangleCount = Math.floor(indices.length / 3);
  return { pack, meshletCount: meshlets.length, triangleCount, warnings: [] };
}

/** Serialize pack for offline transfer (JSON-friendly). */
export function exportMeshletPackJson(pack: MeshletPack): Record<string, unknown> {
  return {
    version: pack.version,
    authority: pack.authority,
    sourceId: pack.sourceId,
    horizontalCrs: pack.horizontalCrs,
    verticalDatum: pack.verticalDatum,
    contentSha256: pack.contentSha256 ?? null,
    meshlets: pack.meshlets,
    geometry: {
      positions: Array.from(pack.geometry.positions),
      indices: Array.from(pack.geometry.indices),
      normals: pack.geometry.normals ? Array.from(pack.geometry.normals) : null,
    },
  };
}

/** Unit cube pilot mesh for smoke tests (Posey local meters arbitrary). */
export function createUnitCubeMesh(sourceId = 'tsm-unit-cube-pilot'): RawMeshInput {
  // 8 corners, 12 triangles
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  ]);
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4,
    3, 4, 0,
  ]);
  return {
    positions,
    indices,
    sourceId,
    horizontalCrs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
  };
}
