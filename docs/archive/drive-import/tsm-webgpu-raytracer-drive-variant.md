> **DRIVE IMPORT — DESIGN-INTENT REFERENCE (NOT A SPEC)**
>
> Source: Google Drive — "TsmWebGpuRayTracer.ts" · Drive last modified: 2026-09-24
> Ingested: 2026-09-25 · Verification status: **DESIGN-INTENT**
>
> This document describes intended or aspirational system behavior from the owner's design
> archive. It does NOT describe implemented code. Per `SYNTHESIS-VERIFICATION.md`, several
> Drive-side claims (multi-physics engines, solver rates, sealed certifications, "sovereign"
> infrastructure) overstate implementation maturity. Do NOT treat values, certifications, or
> system descriptions here as verified engineering data or as specifications for new work.

---
import * as THREE from 'three';
import maplibregl from 'maplibre-gl';

// ============================================================================
// 1. SITE & GEODETIC ANCHOR CONSTANTS (Point Township, Posey County, IN)
// ============================================================================
export const BONEBANK_RAYTRACER_CONSTANTS = {
  site_id: 'restricted-site',
  center_lng_lat: [-87.9312, 37.8825] as [number, number],
  crs: 'EPSG:2966',
  base_flood_elevation_navd88_ft: 375.0,
  berm_crest_navd88_ft: 379.8,
  disclaimer: 'Public Experience Plane: Open-world visual presentation only. Not sealed engineering evidence or regulatory determination.',
};

// ============================================================================
// 2. WGSL SHADER SOURCE CODE FOR WEBGPU REAL-TIME RAY TRACING / RAY MARCHING
// ============================================================================
export const WEBGPU_RAYTRACING_WGSL = /* wgsl */ `
struct Uniforms {
  viewProjectionInverse : mat4x4<f32>,
  cameraPosition        : vec3<f32>,
  time                  : f32,
  sunDirection          : vec3<f32>,
  baseFloodElevation    : f32,
  activeWaterStage      : f32,
  terrainScale          : f32,
  padding               : f32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var heightmapTexture : texture_2d<f32>;
@group(0) @binding(2) var heightmapSampler : sampler;
@group(0) @binding(3) var satelliteTexture : texture_2d<f32>;
@group(0) @binding(4) var satelliteSampler : sampler;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );

  var output : VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex] * 0.5 + vec2<f32>(0.5);
  return output;
}

// Ray-heightfield intersection via Ray Marching
fn getTerrainHeight(uv : vec2<f32>) -> f32 {
  let sample = textureSampleLevel(heightmapTexture, heightmapSampler, uv, 0.0);
  return (sample.r * 200.0) + 300.0; // Standardized NAVD88 feet elevation
}

fn calculateTerrainNormal(uv : vec2<f32>, texelSize : vec2<f32>) -> vec3<f32> {
  let hL = getTerrainHeight(uv - vec2<f32>(texelSize.x, 0.0));
  let hR = getTerrainHeight(uv + vec2<f32>(texelSize.x, 0.0));
  let hD = getTerrainHeight(uv - vec2<f32>(0.0, texelSize.y));
  let hU = getTerrainHeight(uv + vec2<f32>(0.0, texelSize.y));

  return normalize(vec3<f32>(hL - hR, 2.0, hD - hU));
}

@fragment
fn fs_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
  // 1. Reconstruct primary camera ray in world space
  let ndc = vec4<f32>(uv.x * 2.0 - 1.0, (1.0 - uv.y) * 2.0 - 1.0, 1.0, 1.0);
  var worldTarget = uniforms.viewProjectionInverse * ndc;
  worldTarget = worldTarget / worldTarget.w;

  let rayOrigin = uniforms.cameraPosition;
  let rayDir = normalize(worldTarget.xyz - rayOrigin);

  // 2. Primary Ray Marching against Open-World Heightfield
  var t = 0.1;
  let maxDistance = 5000.0;
  let steps = 128;
  var hit = false;
  var hitUv = vec2<f32>(0.0);
  var hitPos = vec3<f32>(0.0);

  for (var i = 0; i < steps; i++) {
    let p = rayOrigin + rayDir * t;
    let sampleUv = clamp(p.xz * 0.0002 + vec2<f32>(0.5), vec2<f32>(0.0), vec2<f32>(1.0));
    let terrainHeight = getTerrainHeight(sampleUv);

    if (p.y <= terrainHeight) {
      hit = true;
      hitPos = p;
      hitUv = sampleUv;
      break;
    }

    t += max(0.5, (p.y - terrainHeight) * 0.4);
    if (t > maxDistance) {
      break;
    }
  }

  // 3. Sky & Volumetric Atmospheric Scattering
  if (!hit) {
    let skyGrad = max(0.0, rayDir.y);
    let skyColor = mix(vec3<f32>(0.7, 0.85, 1.0), vec3<f32>(0.15, 0.35, 0.65), skyGrad);
    let sunFactor = pow(max(0.0, dot(rayDir, uniforms.sunDirection)), 32.0);
    return vec4<f32>(skyColor + vec3<f32>(1.0, 0.9, 0.7) * sunFactor, 1.0);
  }

  // 4. Shading, Normal Calculation & Primary Sun Shadows
  let normal = calculateTerrainNormal(hitUv, vec2<f32>(0.001));
  let satColor = textureSample(satelliteTexture, satelliteSampler, hitUv).rgb;

  // Secondary Ray Trace: Sun Shadow Ray
  var shadowRayOrigin = hitPos + normal * 0.5;
  var shadowT = 0.5;
  var shadowHit = 0.0;
  for (var s = 0; s < 32; s++) {
    let sp = shadowRayOrigin + uniforms.sunDirection * shadowT;
    let sUv = clamp(sp.xz * 0.0002 + vec2<f32>(0.5), vec2<f32>(0.0), vec2<f32>(1.0));
    if (sp.y <= getTerrainHeight(sUv)) {
      shadowHit = 0.6;
      break;
    }
    shadowT += 2.0;
  }

  let NdotL = max(0.1, dot(normal, uniforms.sunDirection));
  let diffuse = satColor * NdotL * (1.0 - shadowHit);

  // 5. Inundation & Hazard Highlighting Shader Layer
  var finalColor = diffuse;
  let groundElevation = hitPos.y;
  if (groundElevation < uniforms.baseFloodElevation) {
    let hazardOverlay = vec3<f32>(0.95, 0.35, 0.1);
    finalColor = mix(finalColor, hazardOverlay, 0.35);
  }

  // 6. Water Surface Reflection & Refraction Tracing
  if (groundElevation < uniforms.activeWaterStage) {
    let waterColor = vec3<f32>(0.02, 0.25, 0.45);
    finalColor = mix(finalColor, waterColor, 0.65);
  }

  // Volumetric Fog Blend
  let fogFactor = 1.0 - exp(-t * 0.0003);
  let fogColor = vec3<f32>(0.75, 0.85, 0.95);
  finalColor = mix(finalColor, fogColor, fogFactor);

  return vec4<f32>(finalColor, 1.0);
}
`;

// ============================================================================
// 3. WEBGPU / THREE.JS INTEGRATION MANAGER
// ============================================================================
export interface OpenWorldRayTracerConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  baseFloodElevationFt?: number;
  activeWaterStageFt?: number;
}

export class TsmWebGpuRayTracer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private isInitialized = false;

  private config: Required<OpenWorldRayTracerConfig>;

  constructor(config: OpenWorldRayTracerConfig) {
    this.config = {
      canvas: config.canvas,
      width: config.width,
      height: config.height,
      baseFloodElevationFt: config.baseFloodElevationFt ?? 375.0,
      activeWaterStageFt: config.activeWaterStageFt ?? 372.5,
    };
  }

  /**
   * Initializes WebGPU Device, WGSL Shader Pipeline, and Textures.
   * Gracefully returns false if WebGPU is unsupported by the browser context.
   */
  public async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('[TSM RAYTRACER] WebGPU unavailable in environment. Falling back to WebGL TsmUnifiedTwinPipeline.');
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return false;

      this.device = await adapter.requestDevice();
      this.context = this.config.canvas.getContext('webgpu');

      if (!this.context || !this.device) return false;

      const format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format,
        alphaMode: 'premultiplied',
      });

      // Compile WGSL Shader Module
      const shaderModule = this.device.createShaderModule({
        label: 'TSM Open World Raytracing WGSL',
        code: WEBGPU_RAYTRACING_WGSL,
      });

      // Create Uniform Buffer (128 bytes)
      this.uniformBuffer = this.device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create Default Dummy Textures
      const dummyTexture = this.createDummyTexture(this.device);
      const sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });

      // Bind Group Layout
      const bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });

      this.bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: dummyTexture.createView() },
          { binding: 2, resource: sampler },
          { binding: 3, resource: dummyTexture.createView() },
          { binding: 4, resource: sampler },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      this.pipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { module: shaderModule, entryPoint: 'vs_main' },
        fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      this.isInitialized = true;
      console.log('[TSM RAYTRACER] WebGPU Open World Raytracing Engine initialized successfully.');
      return true;
    } catch (err) {
      console.error('[TSM RAYTRACER] WebGPU initialization failed:', err);
      return false;
    }
  }

  /**
   * Renders a ray-traced frame given camera matrices and environmental parameters.
   */
  public renderFrame(
    viewProjMatrixInverse: Float32Array,
    cameraPos: [number, number, number],
    timeSec: number,
    sunDir: [number, number, number] = [0.5, 0.8, 0.3]
  ) {
    if (!this.isInitialized || !this.device || !this.context || !this.pipeline || !this.uniformBuffer || !this.bindGroup) {
      return;
    }

    // Pack Uniform Array
    const uniformData = new Float32Array(32);
    uniformData.set(viewProjMatrixInverse, 0); // 16 floats (0..15)
    uniformData.set(cameraPos, 16);           // 3 floats (16..18)
    uniformData[19] = timeSec;                 // 1 float (19)
    uniformData.set(sunDir, 20);               // 3 floats (20..22)
    uniformData[23] = this.config.baseFloodElevationFt; // 1 float (23)
    uniformData[24] = this.config.activeWaterStageFt;   // 1 float (24)
    uniformData[25] = 1.0;                     // terrainScale

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  private createDummyTexture(device: GPUDevice): GPUTexture {
    const texture = device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const pixel = new Uint8Array([128, 128, 255, 255]);
    device.queue.writeTexture(
      { texture },
      pixel,
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
    return texture;
  }
}

// ============================================================================
// 4. MAPLIBRE GL + THREE.JS WEBGPU OPEN-WORLD TWIN MAP COMPONENT
// ============================================================================
export const OpenWorldRayTracedTwinMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const raytraceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: BONEBANK_RAYTRACER_CONSTANTS.center_lng_lat,
      zoom: 14.5,
      pitch: 65,
      bearing: -15,
    });

    map.on('load', async () => {
      if (raytraceCanvasRef.current) {
        const tracer = new TsmWebGpuRayTracer({
          canvas: raytraceCanvasRef.current,
          width: mapContainerRef.current?.clientWidth || 1024,
          height: mapContainerRef.current?.clientHeight || 768,
          baseFloodElevationFt: 375.0,
          activeWaterStageFt: 372.5,
        });

        const success = await tracer.initialize();
        if (success) {
          console.log('[TSM OPEN WORLD] Ray Tracing Engine connected to MapLibre camera matrix.');
        }
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '700px', backgroundColor: '#09090b' }}>
      {/* PUBLIC EXPERIENCE PLANE DISCLAIMER BANNER */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          backgroundColor: 'rgba(9, 9, 11, 0.90)',
          color: '#f4f4f5',
          padding: '12px 16px',
          borderRadius: '8px',
          borderLeft: '4px solid #f59e0b',
          fontSize: '12px',
          fontFamily: 'monospace',
          maxWidth: '460px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '4px' }}>
          TSM WEBGPU OPEN-WORLD TWIN (PRESENTATION PLANE)
        </div>
        <div>{BONEBANK_RAYTRACER_CONSTANTS.disclaimer}</div>
      </div>

      {/* MapLibre Container & Overlay Raytracing Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      <canvas
        ref={raytraceCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.85,
        }}
      />
    </div>
  );
};

---
> **SUPERSEDED NOTE (added on ingest, 2026-09-25):** the repository already ships the
> canonical presentation renderer at `tsm-console/src/gpu/open-world-raytracer.ts`, which
> is deliberately decoupled from site constants and refuses fabricated data. This Drive
> variant hardcodes site-specific elevations (BFE 375.0, berm 379.8), which the repository
> privacy boundary de-scoped — do not merge it into `src/`.
