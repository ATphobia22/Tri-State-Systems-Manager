// R5 research prototype: per-chunk geometric SSE vs threshold → LOD level
// SSE ≈ geometricError * viewportScale / max(distance, epsilon)
// Not production-certified against Cesium; experimental for Pass 2.

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
    sseThreshold: f32,
    viewportScale: f32,
    maxLod: u32,
    _pad: u32,
};

@group(0) @binding(0) var<storage, read> chunks: array<ChunkLodIn>;
@group(0) @binding(1) var<uniform> params: LodParams;
@group(0) @binding(2) var<storage, read_write> selectedLod: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let i = gid.x;
    if (i >= arrayLength(&chunks)) {
        return;
    }
    let c = chunks[i];
    let dist = max(length(c.center - params.cameraPos), 1e-3);
    let sse = (c.geometricError * params.viewportScale) / dist;
    var lod = c.baseLod;
    if (sse > params.sseThreshold && lod < params.maxLod) {
        lod = lod + 1u;
    } else if (sse < params.sseThreshold * 0.5 && lod > 0u) {
        lod = lod - 1u;
    }
    selectedLod[i] = lod;
}
