/**
 * TSM Open-World WebGPU presentation renderer.
 *
 * This module is deliberately independent from MapLibre's WebGL context.
 * MapLibre custom layers render in MapLibre's WebGL context; WebGPU cannot be
 * injected into that context. A caller must therefore provide its own metric
 * local-camera matrices and explicitly verified height/satellite textures.
 *
 * No fabricated texture, datum conversion, BFE, or terrain scale is supplied.
 * The renderer is presentation-only and cannot mutate evidence or model state.
 */

export interface WebGpuTerrainSource {
  readonly heightTexture: GPUTexture;
  readonly satelliteTexture: GPUTexture;
  readonly heightScaleMeters: number;
  readonly heightOffsetMeters: number;
  readonly boundsMeters: readonly [number, number, number, number];
  readonly verticalDatum: string;
  readonly horizontalCrs: string;
  readonly provenanceUri: string;
  readonly provenanceHashSha256: string;
}

export interface WebGpuRenderParameters {
  readonly inverseViewProjection: Float32Array;
  readonly cameraPositionMeters: readonly [number, number, number];
  readonly timeSeconds: number;
  readonly sunDirection: readonly [number, number, number];
  readonly activeWaterStageMeters: number | null;
}

export interface WebGpuInitializationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export const OPEN_WORLD_WEBGPU_WGSL = /* wgsl */ `
struct Uniforms {
  inverseViewProjection : mat4x4<f32>,
  cameraTime : vec4<f32>,
  sunBase : vec4<f32>,
  stageScaleOffset : vec4<f32>,
  bounds : vec4<f32>,
};

@group(0) @binding(0) var<uniform> u : Uniforms;
@group(0) @binding(1) var heightTexture : texture_2d<f32>;
@group(0) @binding(2) var terrainSampler : sampler;
@group(0) @binding(3) var satelliteTexture : texture_2d<f32>;
@group(0) @binding(4) var satelliteSampler : sampler;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );

  var output : VertexOutput;
  output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  output.uv = positions[vertexIndex] * 0.5 + vec2<f32>(0.5);
  return output;
}

fn terrain_uv(xz : vec2<f32>) -> vec2<f32> {
  let minX = u.bounds.x;
  let minZ = u.bounds.y;
  let maxX = u.bounds.z;
  let maxZ = u.bounds.w;
  return clamp(
    (xz - vec2<f32>(minX, minZ)) /
      max(vec2<f32>(maxX - minX, maxZ - minZ), vec2<f32>(0.000001)),
    vec2<f32>(0.0),
    vec2<f32>(1.0)
  );
}

fn terrain_height_meters(xz : vec2<f32>) -> f32 {
  let sampleUv = terrain_uv(xz);
  let encoded = textureSampleLevel(heightTexture, terrainSampler, sampleUv, 0.0).r;
  return encoded * u.stageScaleOffset.y + u.stageScaleOffset.z;
}

fn terrain_normal(xz : vec2<f32>) -> vec3<f32> {
  let span = max(u.bounds.z - u.bounds.x, u.bounds.w - u.bounds.y);
  let epsilon = max(span / 4096.0, 0.01);
  let hL = terrain_height_meters(xz - vec2<f32>(epsilon, 0.0));
  let hR = terrain_height_meters(xz + vec2<f32>(epsilon, 0.0));
  let hD = terrain_height_meters(xz - vec2<f32>(0.0, epsilon));
  let hU = terrain_height_meters(xz + vec2<f32>(0.0, epsilon));
  return normalize(vec3<f32>(hL - hR, 2.0 * epsilon, hD - hU));
}

fn intersect_heightfield(origin : vec3<f32>, direction : vec3<f32>) -> vec4<f32> {
  var t = 0.1;
  let maxDistance = max(u.stageScaleOffset.w, 1.0);

  for (var i = 0; i < 192; i++) {
    let point = origin + direction * t;
    if (
      point.x < u.bounds.x || point.x > u.bounds.z ||
      point.z < u.bounds.y || point.z > u.bounds.w
    ) {
      t += 5.0;
      if (t > maxDistance) { break; }
      continue;
    }

    let terrain = terrain_height_meters(point.xz);
    let distance = point.y - terrain;
    if (distance <= 0.05) {
      return vec4<f32>(point, 1.0);
    }

    t += clamp(distance * 0.45, 0.25, 25.0);
    if (t > maxDistance) { break; }
  }

  return vec4<f32>(0.0);
}

@fragment
fn fs_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
  let ndc = vec4<f32>(
    uv.x * 2.0 - 1.0,
    (1.0 - uv.y) * 2.0 - 1.0,
    1.0,
    1.0
  );

  var target = u.inverseViewProjection * ndc;
  target = target / target.w;

  let origin = u.cameraTime.xyz;
  let direction = normalize(target.xyz - origin);
  let hit = intersect_heightfield(origin, direction);

  if (hit.w == 0.0) {
    let sky = mix(
      vec3<f32>(0.08, 0.16, 0.30),
      vec3<f32>(0.55, 0.72, 0.92),
      max(direction.y, 0.0)
    );
    return vec4<f32>(sky, 1.0);
  }

  let point = hit.xyz;
  let normal = terrain_normal(point.xz);
  let light = normalize(u.sunBase.xyz);
  let diffuse = max(dot(normal, light), 0.15);

  let surfaceUv = terrain_uv(point.xz);
  let satellite = textureSample(satelliteTexture, satelliteSampler, surfaceUv).rgb;
  var color = satellite * diffuse;

  let stageMeters = u.stageScaleOffset.x;
  if (stageMeters >= 0.0 && point.y < stageMeters) {
    color = mix(color, vec3<f32>(0.02, 0.25, 0.45), 0.55);
  }

  let fog = 1.0 - exp(-distance(point, origin) * 0.00015);
  color = mix(color, vec3<f32>(0.72, 0.80, 0.90), clamp(fog, 0.0, 0.75));
  return vec4<f32>(color, 1.0);
}
`;

const UNIFORM_BUFFER_SIZE_BYTES = 128;

export class TsmWebGpuRayTracer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private source: WebGpuTerrainSource | null = null;
  private initialized = false;

  public async initialize(canvas: HTMLCanvasElement): Promise<WebGpuInitializationResult> {
    if (!navigator.gpu) {
      return { ok: false, reason: 'WebGPU unavailable; keep the MapLibre WebGL renderer active.' };
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) {
        return { ok: false, reason: 'No WebGPU adapter was returned.' };
      }

      const device = await adapter.requestDevice();
      device.lost.then((info) => {
        this.initialized = false;
        console.warn('[TSM WEBGPU] Device lost:', info.message);
      });

      const context = canvas.getContext('webgpu');
      if (!context) {
        device.destroy();
        return { ok: false, reason: 'Canvas does not expose a WebGPU context.' };
      }

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      const shaderModule = device.createShaderModule({
        label: 'TSM Open World WebGPU WGSL',
        code: OPEN_WORLD_WEBGPU_WGSL,
      });
      const compilation = await shaderModule.getCompilationInfo();
      const errors = compilation.messages.filter((message) => message.type === 'error');
      if (errors.length > 0) {
        device.destroy();
        return {
          ok: false,
          reason: errors.map((message) => `WGSL \${message.lineNum}:\${message.linePos} \${message.message}`).join('; '),
        };
      }

      this.device = device;
      this.context = context;
      this.uniformBuffer = device.createBuffer({
        label: 'TSM WebGPU presentation uniforms',
        size: UNIFORM_BUFFER_SIZE_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const layout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });

      this.pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
      });

      this.isInitialized = true;
      return { ok: true };
    } catch (error) {
      this.dispose();
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Unknown WebGPU initialization failure.',
      };
    }
  }

  public setTerrainSource(source: WebGpuTerrainSource): void {
    if (!Number.isFinite(source.heightScaleMeters) || !Number.isFinite(source.heightOffsetMeters)) {
      throw new Error('Terrain encoding scale/offset must be finite.');
    }
    if (source.boundsMeters.length !== 4 || source.boundsMeters[0] >= source.boundsMeters[2] || source.boundsMeters[1] >= source.boundsMeters[3]) {
      throw new Error('Terrain bounds are invalid.');
    }
    if (!/^[a-z0-9]+$/i.test(source.provenanceHashSha256) || source.provenanceHashSha256.length !== 64) {
      throw new Error('Terrain provenance hash must be a SHA-256 hex digest.');
    }
    if (!source.horizontalCrs || !source.verticalDatum || !source.provenanceUri) {
      throw new Error('Terrain CRS, vertical datum, and provenance URI are required.');
    }
    this.source = source;
    this.rebuildBindGroup();
  }

  public renderFrame(parameters: WebGpuRenderParameters): void {
    if (!this.initialized || !this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup) {
      return;
    }
    if (parameters.inverseViewProjection.length !== 16) {
      throw new Error('inverseViewProjection must contain exactly 16 float values.');
    }

    const uniformData = new Float32Array(32);
    uniformData.set(parameters.inverseViewProjection, 0);
    uniformData.set([
      parameters.cameraPositionMeters[0],
      parameters.cameraPositionMeters[1],
      parameters.cameraPositionMeters[2],
      parameters.timeSeconds,
      parameters.sunDirection[0],
      parameters.sunDirection[1],
      parameters.sunDirection[2],
      0,
      parameters.activeWaterStageMeters ?? -1,
      this.source?.heightScaleMeters ?? 1,
      this.source?.heightOffsetMeters ?? 0,
      5000,
      ...(this.source?.boundsMeters ?? [0, 0, 1, 1]),
    ], 16);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const encoder = this.device.createCommandEncoder({ label: 'TSM WebGPU frame' });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(6);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  public dispose(): void {
    this.initialized = false;
    this.bindGroup = null;
    this.pipeline = null;
    this.context?.unconfigure();
    this.context = null;
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.device?.destroy();
    this.device = null;
    this.source = null;
  }

  private rebuildBindGroup(): void {
    if (!this.device || !this.uniformBuffer || !this.source) return;

    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    const layout = this.pipeline?.getBindGroupLayout(0);
    if (!layout) return;

    this.bindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.source.heightTexture.createView() },
        { binding: 2, resource: sampler },
        { binding: 3, resource: this.source.satelliteTexture.createView() },
        { binding: 4, resource: sampler },
      ],
    });
  }
}
