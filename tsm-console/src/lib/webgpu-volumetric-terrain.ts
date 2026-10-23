/**
 * TSM WebGPU volumetric terrain capability boundary.
 *
 * IMPORTANT: this class does not implement GPU isosurface extraction.
 * The previous shader draft emitted placeholder triangles rather than a valid
 * marching-cubes mesh. It is intentionally not exposed as a compute pipeline.
 * Static terrain continues through scripts/geospatial/dem_to_transvoxel.py.
 *
 * A GPU device being available is not evidence that GPU terrain extraction,
 * GPU Hierarchical-Z, or Transvoxel transitions are implemented.
 */
import { probeWebGPU, type WebGPUCapabilityReport } from './webgpu-capabilities.ts';

export interface WebGPUVolumetricTerrainConfig {
  volumeDimensions: [number, number, number];
  voxelSize: [number, number, number];
  volumeOrigin: [number, number, number];
  isoLevel?: number;
}

export class WebGPUWorkloadUnavailableError extends Error {
  constructor(message = 'GPU volumetric terrain extraction is not implemented; use the validated CPU mesher.') {
    super(message);
    this.name = 'WebGPUWorkloadUnavailableError';
  }
}

export class WebGPUVolumetricTerrain {
  private device: GPUDevice | null = null;
  private lost = false;
  private report: WebGPUCapabilityReport | null = null;

  get capabilityReport(): WebGPUCapabilityReport | null {
    return this.report;
  }

  get isDeviceLost(): boolean {
    return this.lost;
  }

  /**
   * Acquire a usable WebGPU device. Returns false on unsupported contexts,
   * adapter/device failure, or any exception; callers must keep CPU fallback.
   */
  async initialize(): Promise<boolean> {
    this.report = await probeWebGPU();
    this.device = this.report.device ?? null;
    if (!this.device) return false;

    this.lost = false;
    void this.device.lost.then((info) => {
      this.lost = true;
      this.device = null;
      if (this.report) {
        this.report = {
          status: 'device-unavailable',
          reason: `WebGPU device lost (${info.reason}): ${info.message || 'no additional detail'}`,
          features: this.report.features,
          adapterInfo: this.report.adapterInfo,
        };
      }
    }).catch((error: unknown) => {
      this.lost = true;
      this.device = null;
      if (this.report) {
        this.report = {
          status: 'device-unavailable',
          reason: `WebGPU device-loss observer failed: ${error instanceof Error ? error.message : String(error)}`,
          features: this.report.features,
          adapterInfo: this.report.adapterInfo,
        };
      }
    });
    return true;
  }

  /**
   * GPU extraction is deliberately unavailable rather than returning a fake or
   * empty mesh that downstream code could interpret as valid terrain output.
   */
  async extractMesh(
    _sdfData: Float32Array,
    _config: WebGPUVolumetricTerrainConfig,
  ): Promise<Float32Array> {
    throw new WebGPUWorkloadUnavailableError();
  }

  /** Release the device and make the instance safe to discard. */
  destroy(): void {
    this.device?.destroy();
    this.device = null;
    this.lost = true;
  }

  /** True means only that the API exists, not that an adapter/device works. */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }
}
