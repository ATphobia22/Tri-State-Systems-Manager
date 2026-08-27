// PTDT v35 — WebGPU Terrain Rendering (non-mutating)
// DEM ray-march + water mask relative to locked BFE 375.0 / LAG 377.2
// QL2 vertical accuracy bound: RMSEZ ≤ 0.328 ft (USGS 3DEP)
// Writes only to transient buffers — never to PostGIS / HEC-RAS state

struct Uniforms {
  viewProj: mat4x4<f32>,
  invViewProj: mat4x4<f32>,
  cameraPos: vec3<f32>,
  time: f32,
  lightDir: vec3<f32>,
  bfeFt: f32,          // locked 375.0
  lagFt: f32,          // locked 377.2
  stageFt: f32,        // dynamic presentation stage
  resolution: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var heightSamp: sampler;

fn sampleHeight(xz: vec2<f32>) -> f32 {
  let uv = xz * 0.008 + 0.5;
  let h = textureSampleLevel(heightTex, heightSamp, uv, 0.0).r;
  return h * 48.0 - 12.0;
}

fn terrainSDF(p: vec3<f32>) -> f32 {
  return p.y - sampleHeight(p.xz);
}

@compute @workgroup_size(8, 8, 1)
fn cs_main(@builtin(global_invocation_id) id: vec3<u32>) {
  // Optional pre-pass: displacement / FOST heat-map into transient storage only
}

@fragment
fn fs_main(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = (frag.xy / u.resolution) * 2.0 - 1.0;
  let ndc = vec4<f32>(uv.x, -uv.y, 1.0, 1.0);
  let world = u.invViewProj * ndc;
  let rd = normalize(world.xyz / world.w - u.cameraPos);

  var d = 0.0;
  var p = u.cameraPos;
  for (var i = 0; i < 192; i++) {
    p = u.cameraPos + rd * d;
    let ds = terrainSDF(p);
    if (abs(ds) < 0.02 || d > 800.0) { break; }
    d += ds * 0.85;
  }

  let height = sampleHeight(p.xz);
  // Water mask relative to locked BFE (presentation only)
  let waterMask = select(0.0, 1.0, height < (u.stageFt - u.bfeFt) * 0.3048);
  var col = mix(vec3<f32>(0.12, 0.22, 0.10), vec3<f32>(0.04, 0.25, 0.42), waterMask);
  // Freeboard visual cue vs LAG
  let freeboardHint = select(0.0, 0.15, height > (u.lagFt - u.bfeFt) * 0.3048);
  col = mix(col, vec3<f32>(0.2, 0.6, 0.3), freeboardHint * (1.0 - waterMask));
  col = col / (col + vec3<f32>(1.0)); // ACES-inspired
  return vec4<f32>(pow(col, vec3<f32>(1.0 / 2.2)), 1.0);
}
