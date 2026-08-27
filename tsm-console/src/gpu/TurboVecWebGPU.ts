/**
 * PTDT v35 — TurboVec WebGPU Host Orchestrator
 * NDVI / NDWI compute; transient buffers only.
 */
import { NDVI_WGSL, NDWI_WGSL } from "./turbovecKernels.wgsl";

export interface TurboVecParams {
  width: number;
  height: number;
}

export class TurboVecWebGPU {
  private device!: GPUDevice;
  private ndviPipeline!: GPUComputePipeline;
  private ndwiPipeline!: GPUComputePipeline;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (!navigator.gpu) throw new Error("WebGPU not supported");
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("No GPU adapter");
    this.device = await adapter.requestDevice();

    this.ndviPipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: { module: this.device.createShaderModule({ code: NDVI_WGSL }), entryPoint: "main" },
    });
    this.ndwiPipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: { module: this.device.createShaderModule({ code: NDWI_WGSL }), entryPoint: "main" },
    });
    this.isInitialized = true;
  }

  private async runKernel(
    pipeline: GPUComputePipeline,
    bandA: Float32Array,
    bandB: Float32Array,
    params: TurboVecParams
  ): Promise<Float32Array> {
    const { width, height } = params;
    const length = width * height;
    const byteSize = length * Float32Array.BYTES_PER_ELEMENT;

    const bufferA = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const bufferB = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const outBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const paramsBuffer = this.device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(bufferA, 0, bandA);
    this.device.queue.writeBuffer(bufferB, 0, bandB);
    this.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([width, height]));

    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufferA } },
        { binding: 1, resource: { buffer: bufferB } },
        { binding: 2, resource: { buffer: outBuffer } },
        { binding: 3, resource: { buffer: paramsBuffer } },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();

    const readBuffer = this.device.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyBufferToBuffer(outBuffer, 0, readBuffer, 0, byteSize);
    this.device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    bufferA.destroy();
    bufferB.destroy();
    outBuffer.destroy();
    paramsBuffer.destroy();
    readBuffer.destroy();
    return result;
  }

  async runNDVI(red: Float32Array, nir: Float32Array, params: TurboVecParams): Promise<Float32Array> {
    return this.runKernel(this.ndviPipeline, red, nir, params);
  }

  async runNDWI(green: Float32Array, nir: Float32Array, params: TurboVecParams): Promise<Float32Array> {
    return this.runKernel(this.ndwiPipeline, green, nir, params);
  }
}
