/**
 * Point Township Digital Twin (PTDT) v35 - Client-side WebGPU Shader Kernels
 * Real-time spectral band calculations (NDVI, NDWI). Presentation plane only.
 */

export const NDVI_WGSL = /* wgsl */ `
struct NDVIParams {
    width: u32,
    height: u32,
};

@group(0) @binding(0) var<storage, read> red_band: array<f32>;
@group(0) @binding(1) var<storage, read> nir_band: array<f32>;
@group(0) @binding(2) var<storage, read_write> ndvi_out: array<f32>;
@group(0) @binding(3) var<uniform> params: NDVIParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.width || y >= params.height) {
        return;
    }

    let idx = y * params.width + x;
    let red = red_band[idx];
    let nir = nir_band[idx];
    let den = nir + red;

    var ndvi: f32;
    if (den == 0.0) {
        ndvi = 0.0;
    } else {
        ndvi = (nir - red) / den;
    }

    ndvi_out[idx] = ndvi;
}
`;

export const NDWI_WGSL = /* wgsl */ `
struct NDWIParams {
    width: u32,
    height: u32,
};

@group(0) @binding(0) var<storage, read> green_band: array<f32>;
@group(0) @binding(1) var<storage, read> nir_band: array<f32>;
@group(0) @binding(2) var<storage, read_write> ndwi_out: array<f32>;
@group(0) @binding(3) var<uniform> params: NDWIParams;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.width || y >= params.height) {
        return;
    }

    let idx = y * params.width + x;
    let green = green_band[idx];
    let nir = nir_band[idx];
    let den = green + nir;

    var ndwi: f32;
    if (den == 0.0) {
        ndwi = 0.0;
    } else {
        ndwi = (green - nir) / den;
    }

    ndwi_out[idx] = ndwi;
}
`;
