/**
 * Minimal GLB 2.0 extractor — POSITION (+ optional NORMAL) for meshlet import.
 * Handles non-indexed TRIANGLES (mode 4) used by TSM building 3D Tiles merger.
 */

export interface ExtractedMesh {
  positions: Float32Array;
  normals?: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  generator?: string;
}

const GLB_MAGIC = 0x46546c67; // glTF
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const COMPONENT_FLOAT = 5126;
const MODE_TRIANGLES = 4;

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

export function extractMeshFromGlb(buffer: ArrayBuffer): ExtractedMesh {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20) throw new Error('GLB too small');
  if (readU32(view, 0) !== GLB_MAGIC) throw new Error('not a GLB');
  const version = readU32(view, 4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);

  let offset = 12;
  let json: Record<string, unknown> | null = null;
  let bin: ArrayBuffer | null = null;

  while (offset + 8 <= buffer.byteLength) {
    const chunkLen = readU32(view, offset);
    const chunkType = readU32(view, offset + 4);
    offset += 8;
    const chunkData = buffer.slice(offset, offset + chunkLen);
    offset += chunkLen;
    if (chunkType === CHUNK_JSON) {
      const text = new TextDecoder().decode(chunkData).replace(/\0+$/, '');
      json = JSON.parse(text) as Record<string, unknown>;
    } else if (chunkType === CHUNK_BIN) {
      bin = chunkData;
    }
  }

  if (!json || !bin) throw new Error('GLB missing JSON or BIN chunk');

  const accessors = json.accessors as Array<Record<string, unknown>>;
  const bufferViews = json.bufferViews as Array<Record<string, unknown>>;
  const meshes = json.meshes as Array<Record<string, unknown>>;
  if (!meshes?.length) throw new Error('GLB has no meshes');

  const prim = (meshes[0]!.primitives as Array<Record<string, unknown>>)[0]!;
  const mode = (prim.mode as number | undefined) ?? MODE_TRIANGLES;
  if (mode !== MODE_TRIANGLES) throw new Error(`unsupported primitive mode ${mode}`);

  const attrs = prim.attributes as Record<string, number>;
  const posAcc = accessors[attrs.POSITION!]!;
  if (posAcc.componentType !== COMPONENT_FLOAT || posAcc.type !== 'VEC3') {
    throw new Error('POSITION must be FLOAT VEC3');
  }

  const positions = readAccessorF32(bin, bufferViews, posAcc);
  let normals: Float32Array | undefined;
  if (attrs.NORMAL != null) {
    const nAcc = accessors[attrs.NORMAL]!;
    if (nAcc.componentType === COMPONENT_FLOAT && nAcc.type === 'VEC3') {
      normals = readAccessorF32(bin, bufferViews, nAcc);
    }
  }

  const vertexCount = positions.length / 3;
  let indices: Uint32Array;
  if (prim.indices != null) {
    indices = readIndices(bin, bufferViews, accessors[prim.indices as number]!);
  } else {
    // Non-indexed triangle list (TSM building tiles)
    indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indices[i] = i;
  }

  const triangleCount = Math.floor(indices.length / 3);
  const asset = json.asset as Record<string, string> | undefined;

  return {
    positions,
    normals,
    indices,
    vertexCount,
    triangleCount,
    generator: asset?.generator,
  };
}

function readAccessorF32(
  bin: ArrayBuffer,
  bufferViews: Array<Record<string, unknown>>,
  acc: Record<string, unknown>,
): Float32Array {
  const bv = bufferViews[acc.bufferView as number]!;
  const byteOffset = ((bv.byteOffset as number) ?? 0) + ((acc.byteOffset as number) ?? 0);
  const count = acc.count as number;
  return new Float32Array(bin, byteOffset, count * 3);
}

function readIndices(
  bin: ArrayBuffer,
  bufferViews: Array<Record<string, unknown>>,
  acc: Record<string, unknown>,
): Uint32Array {
  const bv = bufferViews[acc.bufferView as number]!;
  const byteOffset = ((bv.byteOffset as number) ?? 0) + ((acc.byteOffset as number) ?? 0);
  const count = acc.count as number;
  const ct = acc.componentType as number;
  if (ct === 5125) {
    return new Uint32Array(bin, byteOffset, count);
  }
  if (ct === 5123) {
    const u16 = new Uint16Array(bin, byteOffset, count);
    return Uint32Array.from(u16);
  }
  if (ct === 5121) {
    const u8 = new Uint8Array(bin, byteOffset, count);
    return Uint32Array.from(u8);
  }
  throw new Error(`unsupported index componentType ${ct}`);
}

/** Fetch GLB from URL (browser or node 22+). */
export async function extractMeshFromGlbUrl(url: string): Promise<ExtractedMesh> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GLB fetch failed ${res.status} ${url}`);
  return extractMeshFromGlb(await res.arrayBuffer());
}
