// TSM WebGPU terrain presentation shader.
//
// Source-bound only: no hard-coded BFE/LAG/FFE/berm elevations and no datum
// inference. The host application supplies a verified height encoding,
// horizontal bounds, vertical datum and presentation water stage.
// This shader writes only transient pixels; it never mutates evidence/model state.

struct Uniforms {
  invViewProj: mat4x4<f32>,
  cameraTime: vec4<f32>,
  waterScaleOffsetMaxDistance: vec4<f32>,
  bounds: vec4<f32>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var heightSamp: sampler;

fn terrainUv(xz: vec2<f32>) -> vec2<f32> {
  return clamp(
    (xz - u.bounds.xy) / max(u.bounds.zw - u.bounds.xy, vec2<f32>(0.000001)),
    vec2<f32>(0.0),
    vec2<f32>(1.0)
  );
}

fn sampleHeightMeters(xz: vec2<f32>) -> f32 {
  let encoded = textureSampleLevel(heightTex, heightSamp, terrainUv(xz), 0.0).r;
  return encoded * u.waterScaleOffsetMaxDistance.y + u.waterScaleOffsetMaxDistance.z;
}

fn terrainNormal(xz: vec2<f32>) -> vec3<f32> {
  let epsilon = max(max(u.bounds.z - u.bounds.x, u.bounds.w - u.bounds.y) / 4096.0, 0.01);
  let hL = sampleHeightMeters(xz - vec2<f32>(epsilon, 0.0));
  let hR = sampleHeightMeters(xz + vec2<f32>(epsilon, 0.0));
  let hD = sampleHeightMeters(xz - vec2<f32>(0.0, epsilon));
  let hU = sampleHeightMeters(xz + vec2<f32>(0.0, epsilon));
  return normalize(vec3<f32>(hL - hR, 2.0 * epsilon, hD - hU));
}

@fragment
fn fs_main(@builtin(position) frag: vec4<f32>) -> @location(0) vec4<f32> {
  let resolution = vec2<f32>(max(frag.x, 1.0), max(frag.y, 1.0));
  let ndc = vec4<f32>((frag.xy / resolution) * 2.0 - 1.0, 1.0, 1.0);
  var world = u.invViewProj * ndc;
  world = world / world.w;
  let rayOrigin = u.cameraTime.xyz;
  let rayDirection = normalize(world.xyz - rayOrigin);

  var distanceAlongRay = 0.1;
  var hit = false;
  var hitPoint = rayOrigin;
  for (var i = 0; i < 192; i++) {
    let p = rayOrigin + rayDirection * distanceAlongRay;
    if (p.x < u.bounds.x || p.x > u.bounds.z || p.z < u.bounds.y || p.z > u.bounds.w) {
      distanceAlongRay += 5.0;
    } else {
      let separation = p.y - sampleHeightMeters(p.xz);
      if (separation <= 0.05) {
        hit = true;
        hitPoint = p;
        break;
      }
      distanceAlongRay += clamp(separation * 0.45, 0.25, 25.0);
    }
    if (distanceAlongRay > u.waterScaleOffsetMaxDistance.w) { break; }
  }

  if (!hit) {
    let sky = mix(vec3<f32>(0.08, 0.16, 0.30), vec3<f32>(0.55, 0.72, 0.92), max(rayDirection.y, 0.0));
    return vec4<f32>(sky, 1.0);
  }

  let normal = terrainNormal(hitPoint.xz);
  let sun = normalize(vec3<f32>(0.5, 0.8, 0.3));
  let lighting = max(dot(normal, sun), 0.15);
  var color = vec3<f32>(0.38, 0.43, 0.31) * lighting;

  let stageMeters = u.waterScaleOffsetMaxDistance.x;
  if (stageMeters >= 0.0 && hitPoint.y < stageMeters) {
    color = mix(color, vec3<f32>(0.02, 0.25, 0.45), 0.55);
  }

  let fog = clamp(1.0 - exp(-distanceAlongRay * 0.00015), 0.0, 0.75);
  color = mix(color, vec3<f32>(0.72, 0.80, 0.90), fog);
  return vec4<f32>(color, 1.0);
}
