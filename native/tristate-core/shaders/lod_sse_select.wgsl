// Cesium-aligned geometric SSE:
//   SSE = (geometricError * viewportHeightPx) / (distance * sseDenominator)
// sseDenominator from CPU: 2 * tan(fovY/2)

struct ChunkLodIn {
    center: vec3<f32>,
    geometricError: f32,
    baseLod: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
};

struct LodParams {
    cameraPos: vec3<f32>,
    viewportHeightPx: f32,
    sseDenominator: f32,
    maxSsePx: f32,
    maxLod: u32,
};

@group(0) @binding(0) var<storage, read> chunks: array<ChunkLodIn>;
@group(0) @binding(1) var<uniform> params: LodParams;
@group(0) @binding(2) var<storage, read_write> selectedLod: array<u32>;
@group(0) @binding(3) var<storage, read_write> outSse: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= arrayLength(&chunks)) {
        return;
    }
    let c = chunks[i];
    let dist = max(length(c.center - params.cameraPos), 1e-7);
    let denom = max(params.sseDenominator, 1e-7);
    let sse = (c.geometricError * params.viewportHeightPx) / (dist * denom);
    outSse[i] = sse;

    var lod = c.baseLod;
    if (sse > params.maxSsePx && lod > 0u) {
        lod = lod - 1u;
    } else if (sse < params.maxSsePx * 0.25 && lod < params.maxLod) {
        lod = lod + 1u;
    }
    selectedLod[i] = lod;
}
