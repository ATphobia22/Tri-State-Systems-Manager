/**
 * PTDT v35 — WebGPU NDVI compute kernel (scientific presentation plane)
 */
export const NDVI_COMPUTE_SHADER = /* wgsl */ `
struct Dimensions {
  width: u32,
  height: u32,
};

@group(0) @binding(0) var<storage, read> redBand: array<f32>;
@group(0) @binding(1) var<storage, read> nirBand: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputMap: array<f32>;
@group(0) @binding(3) var<uniform> dims: Dimensions;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;
  if (x >= dims.width || y >= dims.height) {
    return;
  }

  let index = y * dims.width + x;
  let r = redBand[index];
  let n = nirBand[index];
  let denom = n + r;
  var ndvi = 0.0;
  if (denom > 0.001) {
    ndvi = (n - r) / denom;
  }
  outputMap[index] = clamp(ndvi, -1.0, 1.0);
}
`;
