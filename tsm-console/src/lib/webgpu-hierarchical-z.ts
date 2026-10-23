/**
 * WebGPU hierarchical-Z pyramid builder.
 *
 * Builds a max-depth mip chain from a real depth texture using GPU compute.
 * Depth convention is standard [0,1], farther values are larger.
 *
 * This is an explicit GPU resource utility; it is not enabled in a renderer
 * until the caller supplies that renderer's depth texture and consumes the
 * resulting pyramid. The caller must recreate the builder after device loss.
 */
export interface GpuDepthPyramid {
  texture: GPUTexture;
  width: number;
  height: number;
  mipLevelCount: number;
  destroy(): void;
}

const DEPTH_TO_R32F_WGSL = `
@group(0) @binding(0) var sourceDepth: texture_depth_2d;
@group(0) @binding(1) var targetMip: texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(targetMip);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let d = textureLoad(sourceDepth, vec2<i32>(gid.xy), 0);
  textureStore(targetMip, vec2<i32>(gid.xy), vec4<f32>(d, 0.0, 0.0, 1.0));
}
`;

const REDUCE_MIP_WGSL = `
@group(0) @binding(0) var sourceMip: texture_2d<f32>;
@group(0) @binding(1) var targetMip: texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(targetMip);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let srcDims = textureDimensions(sourceMip, 0);
  // Partition the full source extent across target texels. Unlike naive 2x2
  // reduction, this includes odd trailing rows/columns and stays conservative.
  let start = (gid.xy * srcDims) / dims;
  let end = ((gid.xy + vec2<u32>(1u)) * srcDims) / dims;
  var maximum = 0.0;
  for (var y = start.y; y < end.y; y++) {
    for (var x = start.x; x < end.x; x++) {
      maximum = max(maximum, textureLoad(sourceMip, vec2<i32>(i32(x), i32(y)), 0).r);
    }
  }
  textureStore(targetMip, vec2<i32>(gid.xy), vec4<f32>(maximum, 0.0, 0.0, 1.0));
}
`;

function positiveDimension(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function mipCount(width: number, height: number): number {
  return Math.floor(Math.log2(Math.max(width, height))) + 1;
}

export class WebGPUHierarchicalZ {
  private readonly depthPipeline: GPUComputePipeline;
  private readonly reducePipeline: GPUComputePipeline;
  private lost = false;
  private destroyed = false;
  private readonly lostReason: Promise<GPUDeviceLostInfo>;

  constructor(private readonly device: GPUDevice) {
    const depthModule = device.createShaderModule({ label: 'TSM H-Z depth copy', code: DEPTH_TO_R32F_WGSL });
    const reduceModule = device.createShaderModule({ label: 'TSM H-Z max reduction', code: REDUCE_MIP_WGSL });
    this.depthPipeline = device.createComputePipeline({
      label: 'TSM H-Z depth copy pipeline',
      layout: 'auto',
      compute: { module: depthModule, entryPoint: 'main' },
    });
    this.reducePipeline = device.createComputePipeline({
      label: 'TSM H-Z max reduction pipeline',
      layout: 'auto',
      compute: { module: reduceModule, entryPoint: 'main' },
    });
    this.lostReason = device.lost.then((info) => {
      this.lost = true;
      return info;
    });
  }

  get isLost(): boolean {
    return this.lost || this.destroyed;
  }

  /** GPU-build a conservative max-depth pyramid from the renderer's depth attachment. */
  build(depthTexture: GPUTexture, width: number, height: number): GpuDepthPyramid {
    if (this.isLost) throw new Error('WebGPU device is lost or this H-Z builder is destroyed; recreate it with a new device');
    positiveDimension(width, 'width');
    positiveDimension(height, 'height');
    if (depthTexture.width < width || depthTexture.height < height) {
      throw new RangeError('depth texture dimensions are smaller than the requested viewport');
    }

    const levels = mipCount(width, height);
    const texture = this.device.createTexture({
      label: 'TSM hierarchical-Z max-depth pyramid',
      size: { width, height, depthOrArrayLayers: 1 },
      mipLevelCount: levels,
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    const encoder = this.device.createCommandEncoder({ label: 'TSM H-Z pyramid dispatches' });
    {
      const pass = encoder.beginComputePass({ label: 'TSM H-Z depth conversion' });
      pass.setPipeline(this.depthPipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.depthPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: depthTexture.createView({ dimension: '2d', baseMipLevel: 0, mipLevelCount: 1 }) },
          { binding: 1, resource: texture.createView({ dimension: '2d', baseMipLevel: 0, mipLevelCount: 1 }) },
        ],
      }));
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();
    }

    let sourceWidth = width;
    let sourceHeight = height;
    for (let level = 1; level < levels; level++) {
      const targetWidth = Math.max(1, Math.floor(sourceWidth / 2));
      const targetHeight = Math.max(1, Math.floor(sourceHeight / 2));
      const pass = encoder.beginComputePass({ label: `TSM H-Z reduce mip ${level}` });
      pass.setPipeline(this.reducePipeline);
      pass.setBindGroup(0, this.device.createBindGroup({
        layout: this.reducePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: texture.createView({ dimension: '2d', baseMipLevel: level - 1, mipLevelCount: 1 }) },
          { binding: 1, resource: texture.createView({ dimension: '2d', baseMipLevel: level, mipLevelCount: 1 }) },
        ],
      }));
      pass.dispatchWorkgroups(Math.ceil(targetWidth / 8), Math.ceil(targetHeight / 8));
      pass.end();
      sourceWidth = targetWidth;
      sourceHeight = targetHeight;
    }

    this.device.queue.submit([encoder.finish()]);
    let destroyed = false;
    return {
      texture,
      width,
      height,
      mipLevelCount: levels,
      destroy() {
        if (!destroyed) {
          texture.destroy();
          destroyed = true;
        }
      },
    };
  }

  /** Device loss is terminal for this instance; callers must request a new device. */
  async waitForDeviceLoss(): Promise<GPUDeviceLostInfo> {
    return this.lostReason;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export const WEBGPU_HIERARCHICAL_Z_STATUS = {
  implementation: 'gpu_compute_max_depth_pyramid',
  gpuComputeImplemented: true,
  rendererIntegration: 'TsmWebGpuRayTracer.renderFrameWithOcclusion',
  cullingDispatch: 'gpu_compute_candidate_classifier',
  benchmarkEvidence: 'not_collected',
} as const;
