struct TransformUniforms {
  viewProjection : mat4x4<f32>,
};

struct SimulationUniforms {
  activeFloodMask : u32,
  floodDepthScale : f32,
  wetnessDistanceM : f32,
  ambientIntensity : f32,
};

struct LightUniforms {
  sunDirection : vec3<f32>,
  _padding : f32,
};

struct OrthoMappingUniforms {
  minX : f32,
  minY : f32,
  scaleX : f32,
  scaleY : f32,
};

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) statePlane : vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) worldPosition : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) orthoUv : vec2<f32>,
};

@group(0) @binding(0) var<uniform> transforms : TransformUniforms;
@group(0) @binding(1) var<uniform> simulation : SimulationUniforms;
@group(0) @binding(2) var<uniform> lighting : LightUniforms;
@group(0) @binding(3) var<uniform> ortho : OrthoMappingUniforms;

@group(1) @binding(0) var linearSampler : sampler;
@group(1) @binding(1) var orthoTexture : texture_2d<f32>;
@group(1) @binding(2) var floodDepthTexture : texture_2d<f32>;

@vertex
fn vsMain(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  output.position = transforms.viewProjection * vec4(input.position, 1.0);
  output.worldPosition = input.position;
  output.normal = normalize(input.normal);
  output.orthoUv = vec2(
    (input.statePlane.x - ortho.minX) * ortho.scaleX,
    1.0 - (input.statePlane.y - ortho.minY) * ortho.scaleY,
  );
  return output;
}

@fragment
fn fsMain(input : VertexOutput) -> @location(0) vec4<f32> {
  let uv = clamp(input.orthoUv, vec2(0.0), vec2(1.0));
  var base = textureSample(orthoTexture, linearSampler, uv);
  let floodDepth = max(textureSample(floodDepthTexture, linearSampler, uv).r, 0.0);

  let normal = normalize(input.normal);
  let sun = normalize(lighting.sunDirection);
  let diffuse = max(dot(normal, sun), 0.0);
  let daylight = max(lighting.sunDirection.z, 0.0);
  let illumination = simulation.ambientIntensity + diffuse * (0.25 + 0.75 * daylight);
  base = vec4(base.rgb * illumination, base.a);

  var overlay = vec4(0.0);
  if (simulation.activeFloodMask != 0u && floodDepth > 0.0) {
    // Scenario color is presentation-only; authoritative depth remains the sampled field.
    let intensity = clamp(floodDepth * simulation.floodDepthScale, 0.0, 1.0);
    if (simulation.activeFloodMask == 1u) {
      overlay = vec4(0.05, 0.35, 0.85, 0.25 + 0.45 * intensity);
    } else if (simulation.activeFloodMask == 2u) {
      overlay = vec4(0.95, 0.22, 0.10, 0.25 + 0.45 * intensity);
    } else if (simulation.activeFloodMask == 3u) {
      overlay = vec4(0.90, 0.75, 0.05, 0.25 + 0.45 * intensity);
    }
  }

  if (overlay.a > 0.0) {
    base = mix(base, overlay, overlay.a);
  }
  return base;
}
