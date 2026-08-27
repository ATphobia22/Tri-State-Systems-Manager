// PTDT v35 — Multi-View Terrain Compute (presentation only)
// Deterministic displacement; freeze `time` uniform for visual regression.

struct ViewMatrices {
    mvp_matrices: array<mat4x4<f32>, 4>,
};

struct TerrainParams {
    width: u32,
    height: u32,
    time: f32,
    active_viewports: u32,
};

@group(0) @binding(0) var<uniform> views: ViewMatrices;
@group(0) @binding(1) var<uniform> params: TerrainParams;
@group(0) @binding(2) var<storage, read> raw_dem_buffer: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_vertex_grid: array<f32>;

@compute @workgroup_size(16, 16)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.width || y >= params.height) {
        return;
    }

    let idx = y * params.width + x;
    let base_height = raw_dem_buffer[idx];

    // Deterministic wave; pass fixed time in CI snapshots
    let wave_factor =
        sin(f32(x) * 0.32 + params.time) * 0.2 +
        cos(f32(y) * 0.26 + params.time) * 0.14;

    let adjusted_elevation = base_height + wave_factor;
    let vertex_offset = idx * 3u;
    output_vertex_grid[vertex_offset + 0u] = f32(x) - (f32(params.width) / 2.0);
    output_vertex_grid[vertex_offset + 1u] = adjusted_elevation;
    output_vertex_grid[vertex_offset + 2u] = f32(y) - (f32(params.height) / 2.0);
}
