/**
 * GPU depth pyramid (Hierarchical-Z) via WebGPU compute.
 * Max-reduce 2×2 per mip. Nanite plane B only — not MapLibre.
 */

const WG = 8;

const PYRAMID_WGSL = /* wgsl */ `
struct Params {
  src_width: u32,
  src_height: u32,
  dst_width: u32,
  dst_height: u32,
};

@group(0) @binding(0) var<storage, read> src_depth: array<f32>;
@group(0) @binding(1) var<storage, read_write> dst_depth: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(${WG}, ${WG})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= params.dst_width || y >= params.dst_height) {
    return;
  }
  let sx0 = min(x * 2u, params.src_width - 1u);
  let sy0 = min(y * 2u, params.src_height - 1u);
  let sx1 = min(sx0 + 1u, params.src_width - 1u);
  let sy1 = min(sy0 + 1u, params.src_height - 1u);
  let d00 = src_depth[sy0 * params.src_width + sx0];
  let d10 = src_depth[sy0 * params.src_width + sx1];
  let d01 = src_depth[sy1 * params.src_width + sx0];
  let d11 = src_depth[sy1 * params.src_width + sx1];
  dst_depth[y * params.dst_width + x] = max(max(d00, d10), max(d01, d11));
}
`;

export interface DepthPyramidGpu {
  levels: GPUBuffer[];
  widths: number[];
  heights: number[];
  dispose: () => void;
}

export class DepthPyramidBuilder {
  private readonly device: GPUDevice;
  private pipeline: GPUComputePipeline | null = null;
  private paramBuffer: GPUBuffer | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private ensurePipeline(): GPUComputePipeline {
    if (this.pipeline) return this.pipeline;
    const module = this.device.createShaderModule({ code: PYRAMID_WGSL, label: 'tsm-depth-pyramid' });
    this.pipeline = this.device.createComputePipeline({
      label: 'tsm-depth-pyramid-pipeline',
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });
    this.paramBuffer = this.device.createBuffer({
      label: 'tsm-depth-pyramid-params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    return this.pipeline;
  }

  async buildFromDepthArray(
    depth: Float32Array,
    width: number,
    height: number,
  ): Promise<DepthPyramidGpu> {
    if (width < 1 || height < 1) throw new RangeError('invalid dimensions');
    if (depth.length < width * height) throw new RangeError('depth buffer too small');

    const pipeline = this.ensurePipeline();
    const levels: GPUBuffer[] = [];
    const widths: number[] = [];
    const heights: number[] = [];

    let w = width;
    let h = height;
    const base = this.device.createBuffer({
      label: 'tsm-depth-l0',
      size: Math.max(4, depth.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.device.queue.writeBuffer(base, 0, depth);
    levels.push(base);
    widths.push(w);
    heights.push(h);

    while (w > 1 || h > 1) {
      const nw = Math.max(1, Math.ceil(w / 2));
      const nh = Math.max(1, Math.ceil(h / 2));
      const dst = this.device.createBuffer({
        label: `tsm-depth-l${levels.length}`,
        size: Math.max(4, nw * nh * 4),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      const params = new Uint32Array([w, h, nw, nh]);
      this.device.queue.writeBuffer(this.paramBuffer!, 0, params);

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: levels[levels.length - 1]! } },
          { binding: 1, resource: { buffer: dst } },
          { binding: 2, resource: { buffer: this.paramBuffer! } },
        ],
      });

      const encoder = this.device.createCommandEncoder({ label: 'tsm-depth-pyramid-encode' });
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(nw / WG), Math.ceil(nh / WG));
      pass.end();
      this.device.queue.submit([encoder.finish()]);

      levels.push(dst);
      widths.push(nw);
      heights.push(nh);
      w = nw;
      h = nh;
    }

    return {
      levels,
      widths,
      heights,
      dispose: () => {
        for (const b of levels) b.destroy();
      },
    };
  }

  dispose(): void {
    this.paramBuffer?.destroy();
    this.paramBuffer = null;
    this.pipeline = null;
  }
}

export function buildDepthPyramidCpu(
  depth: Float32Array,
  width: number,
  height: number,
): { levels: Float32Array[]; widths: number[]; heights: number[] } {
  const levels: Float32Array[] = [];
  const widths: number[] = [];
  const heights: number[] = [];
  let w = width;
  let h = height;
  let current = depth.slice(0, w * h);
  levels.push(current);
  widths.push(w);
  heights.push(h);
  while (w > 1 || h > 1) {
    const nw = Math.max(1, Math.ceil(w / 2));
    const nh = Math.max(1, Math.ceil(h / 2));
    const next = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let maxD = -Infinity;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(w - 1, x * 2 + dx);
            const sy = Math.min(h - 1, y * 2 + dy);
            maxD = Math.max(maxD, current[sy * w + sx]!);
          }
        }
        next[y * nw + x] = maxD;
      }
    }
    levels.push(next);
    widths.push(nw);
    heights.push(nh);
    current = next;
    w = nw;
    h = nh;
  }
  return { levels, widths, heights };
}
