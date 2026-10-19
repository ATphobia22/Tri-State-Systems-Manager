/**
 * Load a building GLB from the public 3D Tiles tree and produce a MeshletPack.
 */

import { extractMeshFromGlb, extractMeshFromGlbUrl } from './glb-mesh-extract';
import { buildMeshletsGreedy, type RawMeshInput } from './meshlet-import';
import type { MeshletImportResult } from './meshlet-types';
import { DEFAULT_MESHLET_PILOT_ID, getMeshSource } from './mesh-catalog';

export interface GlbMeshletOptions {
  sourceId?: string;
  horizontalCrs?: string;
  verticalDatum?: string;
}

export async function meshletsFromGlbUrl(
  url: string,
  options: GlbMeshletOptions = {},
): Promise<MeshletImportResult> {
  const mesh = await extractMeshFromGlbUrl(url);
  const input: RawMeshInput = {
    positions: mesh.positions,
    indices: mesh.indices,
    normals: mesh.normals,
    sourceId: options.sourceId ?? url,
    horizontalCrs: options.horizontalCrs ?? 'EPSG:4326',
    verticalDatum: options.verticalDatum ?? 'NAVD88',
  };
  const result = buildMeshletsGreedy(input);
  if (mesh.generator) {
    result.warnings.push(`glb generator: ${mesh.generator}`);
  }
  result.warnings.push(
    `extracted ${mesh.vertexCount} verts / ${mesh.triangleCount} tris from GLB`,
  );
  return result;
}

export function meshletsFromGlbArrayBuffer(
  buffer: ArrayBuffer,
  options: GlbMeshletOptions = {},
): MeshletImportResult {
  const mesh = extractMeshFromGlb(buffer);
  return buildMeshletsGreedy({
    positions: mesh.positions,
    indices: mesh.indices,
    normals: mesh.normals,
    sourceId: options.sourceId ?? 'glb-buffer',
    horizontalCrs: options.horizontalCrs ?? 'EPSG:4326',
    verticalDatum: options.verticalDatum ?? 'NAVD88',
  });
}

/** Preferred in-repo pilot: smallest buildings-lidar GLB. */
export async function meshletsFromDefaultPilot(): Promise<MeshletImportResult> {
  const entry = getMeshSource(DEFAULT_MESHLET_PILOT_ID);
  if (!entry) throw new Error('default pilot missing from catalog');
  return meshletsFromGlbUrl(entry.publicUrl, {
    sourceId: entry.id,
    horizontalCrs: 'EPSG:4326',
    verticalDatum: 'NAVD88',
  });
}
