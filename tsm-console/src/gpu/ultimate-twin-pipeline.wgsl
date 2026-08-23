struct TransformUniforms {
  viewProjection : mat4x4<f32>,
};

struct SimulationUniforms {
  floodThresholdMeters : f32,
  attenuationCoeff : f32,
  activeScenario : u32,
  _padding : u32,
};

struct LightUniforms {
  sunDirection : vec3<f32>,
  ambientIntensity : f32,
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
  @location(2) statePlaneCoord : vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) orthoUv : vec2<f32>,
};

@group(0) @binding(0) var<uniform> transforms : TransformUniforms;
@group(0) @binding(1) var<uniform> sim : SimulationUniforms;
@group(0) @binding(2) var<uniform> lighting : LightUniforms;
@group(0) @binding(3) var<uniform> ortho : OrthoMappingUniforms;
@group(1) @binding(0) var linearSampler : sampler;
@group(1) @binding(1) var orthoTexture : texture_2d<f32>;
@group(1) @binding(2) var floodDepthTexture : texture_2d<f32>;

@vertex
fn vsMain(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  output.position = transforms.viewProjection * vec4(input.position, 1.0);
  output.worldPos = input.position;
  output.normal = normalize(input.normal);
  output.orthoUv = vec2(
    (input.statePlaneCoord.x - ortho.minX) * ortho.scaleX,
    1.0 - (input.statePlaneCoord.y - ortho.minY) * ortho.scaleY
  );
  return output;
}

@fragment
fn fsMain(input : VertexOutput) -> @location(0) vec4<f32> {
  let uv = clamp(input.orthoUv, vec2(0.0), vec2(1.0));
  var base = textureSample(orthoTexture, linearSampler, uv);
  let depth = textureSample(floodDepthTexture, linearSampler, uv).r;

  let normal = normalize(input.normal);
  let sun = normalize(lighting.sunDirection);
  let diffuse = max(dot(normal, sun), 0.0);
  let light = lighting.ambientIntensity + select(diffuse, 0.05, lighting.sunDirection.z < 0.0);
  base = vec4(base.rgb * light, base.a);

  if (sim.activeScenario != 0u && depth >= sim.floodThresholdMeters) {
    let depthFactor = clamp(depth * 0.15, 0.0, 1.0);
    let water = vec4(0.05, 0.25, 0.70, 0.62);
    base = mix(base, water, water.a * depthFactor);
  } else if (sim.activeScenario == 0u && depth > 0.0) {
    let wetness = clamp(depth * sim.attenuationCoeff, 0.0, 0.35);
    base = vec4(base.rgb * (1.0 - wetness), base.a);
  }

  return base;
}
