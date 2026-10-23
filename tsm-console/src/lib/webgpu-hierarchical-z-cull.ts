/**
 * GPU-side conservative H-Z visibility classification.
 *
 * Input records use eight Float32 values per candidate (32 bytes):
 * [minX, minY, maxX, maxY, nearestDepth, reserved, reserved, reserved].
 * Screen coordinates are inclusive pixel coordinates. Output is one u32 per
 * candidate: 1 = visible/uncertain, 0 = occluded. Invalid candidates fail open.
 */
const CULL_WGSL = `
struct Candidate {
  rect: vec4<f32>,
  nearestDepth: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};
struct Params {
  width: u32,
  height: u32,
  candidateCount: u32,
  depthBias: f32,
};
@group(0) @binding(0) var pyramid: texture_2d<f32>;
@group(0) @binding(1) var<storage, read> candidates: array<Candidate>;
@group(0) @binding(2) var<storage, read_write> visibility: array<u32>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let index = gid.x;
  if (index >= params.candidateCount) { return; }
  let c = candidates[index];
  let rect = c.rect;
  if (any(isNan(rect)) || any(isInf(rect)) || isNan(c.nearestDepth) || isInf(c.nearestDepth)
      || c.nearestDepth < 0.0 || c.nearestDepth > 1.0
      || rect.x > rect.z || rect.y > rect.w) {
    visibility[index] = 1u;
    return;
  }
  if (rect.z < 0.0 || rect.w < 0.0 || rect.x >= f32(params.width) || rect.y >= f32(params.height)) {
    visibility[index] = 1u;
    return;
  }
  let minPixel = vec2<u32>(floor(clamp(rect.xy, vec2<f32>(0.0), vec2<f32>(f32(params.width - 1u), f32(params.height - 1u)))));
  let maxPixel = vec2<u32>(floor(clamp(rect.zw, vec2<f32>(0.0), vec2<f32>(f32(params.width - 1u), f32(params.height - 1u)))));
  var level = 0u;
  var lo = minPixel;
  var hi = maxPixel;
  loop {
    if (level + 1u >= textureNumLevels(pyramid)) { break; }
    let span = hi - lo + vec2<u32>(1u);
    if (span.x <= 2u && span.y <= 2u) { break; }
    level += 1u;
    lo = minPixel / (1u << level);
    hi = maxPixel / (1u << level);
  }
  var maxDepth = 0.0;
  for (var y = lo.y; y <= hi.y; y++) {
    for (var x = lo.x; x <= hi.x; x++) {
      maxDepth = max(maxDepth, textureLoad(pyramid, vec2<i32>(i32(x), i32(y)), i32(level)).r);
    }
  }
  // Max-depth reduction is conservative for standard depth: any far-depth hole
  // raises maxDepth and prevents a false occlusion classification.
  visibility[index] = select(1u, 0u, c.nearestDepth > maxDepth + params.depthBias);
}
`;

export interface GpuHZAabbCandidate {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nearestDepth: number;
}

export class WebGPUHierarchicalZCuller {
  private readonly pipeline: GPUComputePipeline;
  private destroyed = false;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: 'TSM H-Z candidate culling', code: CULL_WGSL });
    this.pipeline = device.createComputePipeline({
      label: 'TSM H-Z candidate culling pipeline',
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
  }

  async classify(
    pyramid: GPUTexture,
    width: number,
    height: number,
    candidates: readonly GpuHZAabbCandidate[],
    depthBias = 1e-5,
  ): Promise<Uint32Array> {
    if (this.destroyed) throw new Error('H-Z culler is destroyed');
    if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
      throw new RangeError('viewport dimensions must be positive safe integers');
    }
    if (!Number.isFinite(depthBias) || depthBias < 0) throw new RangeError('depthBias must be finite >= 0');
    if (candidates.length === 0) return new Uint32Array();

    const stride = 8;
    const packed = new Float32Array(candidates.length * stride);
    candidates.forEach((candidate, i) => {
      packed[i * stride] = candidate.minX;
      packed[i * stride + 1] = candidate.minY;
      packed[i * stride + 2] = candidate.maxX;
      packed[i * stride + 3] = candidate.maxY;
      packed[i * stride + 4] = candidate.nearestDepth;
    });
    const input = this.device.createBuffer({
      label: 'TSM H-Z candidate bounds',
      size: packed.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const output = this.device.createBuffer({
      label: 'TSM H-Z visibility results',
      size: candidates.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const params = this.device.createBuffer({
      label: 'TSM H-Z culling parameters',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const readback = this.device.createBuffer({
      label: 'TSM H-Z visibility readback',
      size: candidates.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    try {
      this.device.queue.writeBuffer(input, 0, packed);
      this.device.queue.writeBuffer(params, 0, new Uint32Array([width, height, candidates.length]));
      this.device.queue.writeBuffer(params, 12, new Float32Array([depthBias]));
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: pyramid.createView({ dimension: '2d' }) },
          { binding: 1, resource: { buffer: input } },
          { binding: 2, resource: { buffer: output } },
          { binding: 3, resource: { buffer: params } },
        ],
      });
      const encoder = this.device.createCommandEncoder({ label: 'TSM H-Z culling dispatch' });
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(candidates.length / 64));
      pass.end();
      encoder.copyBufferToBuffer(output, 0, readback, 0, candidates.length * Uint32Array.BYTES_PER_ELEMENT);
      this.device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      return new Uint32Array(readback.getMappedRange().slice(0));
    } finally {
      if (readback.mapState === 'mapped') readback.unmap();
      input.destroy();
      output.destroy();
      params.destroy();
      readback.destroy();
    }
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export const WEBGPU_HZ_CULL_STATUS = {
  implementation: 'gpu_compute_candidate_visibility',
  resultSemantics: '1_visible_or_uncertain_0_occluded',
  rendererIntegration: 'renderer_must_supply_depth_texture_and_candidate_bounds',
  benchmarkEvidence: 'not_collected',
} as const;
