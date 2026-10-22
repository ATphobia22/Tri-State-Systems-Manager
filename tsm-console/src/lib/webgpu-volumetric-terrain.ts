/**
 * TSM WebGPU Volumetric Terrain Renderer
 *
 * STATUS (2026-10-22): Permanent CPU bridge. The GPU compute path below is
 * architecture documentation only — it is NOT a working implementation.
 *
 * Rationale for CPU bridge (not a temporary stub):
 * 1. The CPU pipeline (scripts/geospatial/dem_to_transvoxel.py) is complete,
 *    tested, and produces correct Transvoxel meshes from real DEM data.
 * 2. A full GPU marching-cubes implementation requires the 256-entry edge
 *    table and 256-entry triangle table ported to WGSL — substantial work
 *    with no correctness benefit over the CPU path for TSM's use case
 *    (static terrain baked offline, not real-time deformation).
 * 3. TSM's terrain is precomputed offline and served as 3D Tiles. GPU
 *    extraction would only help for real-time SDF editing, which is not
 *    a TSM requirement (no simulations except flooding/berm/road placement).
 * 4. Cannot be tested here: this environment has no GPU and no WebGPU-capable
 *    browser. Shipping untested GPU compute code would violate the
 *    evidence-over-theater principle.
 *
 * If real-time GPU isosurface extraction becomes a requirement:
 * - Port the full MC edge/triangle tables to WGSL const arrays
 * - Implement atomic triangle compaction and indirect draw
 * - Test on real WebGPU hardware (Chrome 113+, not this VM)
 * - See scripts/geospatial/dem_to_transvoxel.py for the reference CPU logic
 *
 * Based on:
 * - Lengyel Transvoxel algorithm (2010) for LOD transitions
 * - WebGPU marching cubes with compute shaders (jeantimex/fluid pattern)
 * - TSM's existing transvoxel bridge (scripts/geospatial/dem_to_transvoxel.py)
 *
 * Architecture (documented, not implemented):
 * 1. Upload DEM-derived SDF volume to GPU as 3D texture
 * 2. Compute shader: marching cubes per voxel (parallel)
 *    - Uses precomputed edge/triangle tables
 *    - Atomic counter for triangle output
 * 3. Render pass: draw extracted mesh with indirect commands
 * 4. Transvoxel transition cells for crack-free LOD boundaries
 */

// WGSL Compute Shader: Marching Cubes Extraction
export const MARCHING_CUBES_COMPUTE_WGSL = /* wgsl */ `
  // 3D texture containing signed distance field
  @group(0) @binding(0) var sdfVolume: texture_3d<f32>;
  @group(0) @binding(1) var<storage, read_write> triangleBuffer: array<vec4<f32>>;
  @group(0) @binding(2) var<storage, read_write> triangleCount: atomic<u32>;
  @group(0) @binding(3) var<uniform> params: Params;

  struct Params {
    volumeDims: vec3<u32>,
    isoLevel: f32,
    voxelSize: vec3<f32>,
    volumeOrigin: vec3<f32>,
  }

  // Marching cubes edge table (256 entries, simplified)
  // Full table would be 256x16; this is a compressed version
  fn getEdgeTable(cubeIndex: u32) -> u32 {
    // Standard MC edge table lookup
    // In production, this would be a const array
    return 0u; // Placeholder - full table needed
  }

  @compute @workgroup_size(8, 8, 8)
  fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (gid.x >= params.volumeDims.x - 1u ||
        gid.y >= params.volumeDims.y - 1u ||
        gid.z >= params.volumeDims.z - 1u) {
      return;
    }

    // Sample 8 corners of the voxel
    var corners: array<f32, 8>;
    corners[0] = textureLoad(sdfVolume, gid, 0).r;
    corners[1] = textureLoad(sdfVolume, gid + vec3<u32>(1u, 0u, 0u), 0).r;
    corners[2] = textureLoad(sdfVolume, gid + vec3<u32>(1u, 1u, 0u), 0).r;
    corners[3] = textureLoad(sdfVolume, gid + vec3<u32>(0u, 1u, 0u), 0).r;
    corners[4] = textureLoad(sdfVolume, gid + vec3<u32>(0u, 0u, 1u), 0).r;
    corners[5] = textureLoad(sdfVolume, gid + vec3<u32>(1u, 0u, 1u), 0).r;
    corners[6] = textureLoad(sdfVolume, gid + vec3<u32>(1u, 1u, 1u), 0).r;
    corners[7] = textureLoad(sdfVolume, gid + vec3<u32>(0u, 1u, 1u), 0).r;

    // Compute cube index
    var cubeIndex: u32 = 0u;
    for (var i: u32 = 0u; i < 8u; i++) {
      if (corners[i] < params.isoLevel) {
        cubeIndex |= (1u << i);
      }
    }

    // Skip empty/full cubes
    if (cubeIndex == 0u || cubeIndex == 255u) {
      return;
    }

    // Get triangle configuration
    // In full implementation: lookup triangle table, interpolate vertices,
    // append to triangleBuffer via atomicAdd(&triangleCount, vertexCount)

    // Simplified: emit a placeholder to show the pipeline works
    let triIdx = atomicAdd(&triangleCount, 3u);
    let basePos = params.volumeOrigin + vec3<f32>(gid) * params.voxelSize;

    triangleBuffer[triIdx] = vec4<f32>(basePos, 1.0);
    triangleBuffer[triIdx + 1u] = vec4<f32>(basePos + vec3<f32>(params.voxelSize.x, 0.0, 0.0), 1.0);
    triangleBuffer[triIdx + 2u] = vec4<f32>(basePos + vec3<f32>(0.0, params.voxelSize.y, 0.0), 1.0);
  }
`;

// WGSL: Transvoxel transition cell handling
export const TRANSVOXEL_TRANSITION_WGSL = /* wgsl */ `
  // Transvoxel transition cells for LOD boundaries
  // Based on Lengyel 2010: 73 transition cell classes
  //
  // Key insight from TSM's CPU implementation:
  // In a 2:1 balanced octree with analytic SDF, coarse faces already have
  // bit-identical sample points to fine faces. Per-leaf meshing at native
  // resolution is provably crack-free.
  //
  // This shader implements the transition logic for cases where
  // forced subdivision is needed.

  struct TransitionParams {
    lodLevel: u32,
    neighborLod: vec3<u32>,  // LOD of -x, -y, -z neighbors
    cellSize: f32,
  }

  @group(0) @binding(0) var<uniform> transParams: TransitionParams;

  // Determine if this cell needs transition geometry
  fn needsTransition(neighborLod: u32, currentLod: u32) -> bool {
    // Transition needed when neighbor is coarser (lower LOD number = coarser)
    return neighborLod < currentLod;
  }

  // Generate skirt geometry to hide cracks
  // (Simplified - full Transvoxel uses 73 precomputed classes)
  fn generateSkirt(
    edgeVertices: array<vec3<f32>, 4>,
    skirtDepth: f32
  ) -> array<vec3<f32>, 8> {
    var result: array<vec3<f32>, 8>;
    for (var i: u32 = 0u; i < 4u; i++) {
      result[i * 2u] = edgeVertices[i];
      result[i * 2u + 1u] = edgeVertices[i] - vec3<f32>(0.0, skirtDepth, 0.0);
    }
    return result;
  }
`;

export interface WebGPUVolumetricTerrainConfig {
  volumeDimensions: [number, number, number];
  voxelSize: [number, number, number];
  volumeOrigin: [number, number, number];
  isoLevel?: number;
}

/**
 * WebGPU volumetric terrain renderer.
 * Requires WebGPU support (Chrome 113+, Edge 113+, Safari 26+).
 */
export class WebGPUVolumetricTerrain {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported on this device');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn('No WebGPU adapter found');
      return false;
    }

    this.device = await adapter.requestDevice();
    return true;
  }

  /**
   * Upload SDF volume to GPU and extract mesh.
   *
   * NOT IMPLEMENTED — permanent CPU bridge (see file header).
   * Use scripts/geospatial/dem_to_transvoxel.py for mesh extraction.
   * This method returns an empty array and logs the redirection.
   *
   * @param sdfData - 3D array of signed distance values (unused)
   * @param config - Volume configuration (unused)
   */
  async extractMesh(
    _sdfData: Float32Array,
    _config: WebGPUVolumetricTerrainConfig
  ): Promise<Float32Array> {
    console.warn(
      'WebGPUVolumetricTerrain.extractMesh: GPU path not implemented (permanent CPU bridge). ' +
      'Use scripts/geospatial/dem_to_transvoxel.py for mesh extraction.'
    );
    return new Float32Array(0);
  }

  /**
   * Check if WebGPU is available (for feature detection).
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }
}
