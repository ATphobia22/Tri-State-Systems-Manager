/**
 * WebGPU capability probe for TSM.
 *
 * Distinguishes API presence from a successfully created GPU device. This is
 * capability detection only; it does not imply that terrain extraction,
 * hierarchical-Z occlusion, or any other GPU workload is implemented.
 */
export type WebGPUProbeStatus =
  | 'unsupported'
  | 'adapter-unavailable'
  | 'device-unavailable'
  | 'ready';

export interface WebGPUCapabilityReport {
  status: WebGPUProbeStatus;
  reason?: string;
  adapterInfo?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  features: string[];
  limits?: {
    maxBufferSize: number;
    maxStorageBufferBindingSize: number;
    maxTextureDimension2D: number;
    maxTextureDimension3D: number;
    maxComputeWorkgroupsPerDimension: number;
  };
  device?: GPUDevice;
}

/**
 * Probe the current environment or an injected GPU object (useful for tests).
 * All failures are converted to an explicit report so callers can choose a
 * CPU fallback instead of confusing API presence with usable hardware.
 */
export async function probeWebGPU(gpu?: GPU | null): Promise<WebGPUCapabilityReport> {
  const availableGpu =
    gpu === undefined
      ? (typeof navigator !== 'undefined' ? navigator.gpu : undefined)
      : gpu;

  if (!availableGpu) {
    return {
      status: 'unsupported',
      reason: 'WebGPU API is unavailable in this execution context.',
      features: [],
    };
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await availableGpu.requestAdapter();
  } catch (error) {
    return {
      status: 'adapter-unavailable',
      reason: error instanceof Error ? error.message : String(error),
      features: [],
    };
  }

  if (!adapter) {
    return {
      status: 'adapter-unavailable',
      reason: 'WebGPU is exposed, but no adapter could be acquired.',
      features: [],
    };
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (error) {
    return {
      status: 'device-unavailable',
      reason: error instanceof Error ? error.message : String(error),
      features: [...adapter.features],
    };
  }

  const info = adapter.info;
  return {
    status: 'ready',
    features: [...device.features].sort(),
    adapterInfo: {
      vendor: info.vendor || undefined,
      architecture: info.architecture || undefined,
      device: info.device || undefined,
      description: info.description || undefined,
    },
    limits: {
      maxBufferSize: device.limits.maxBufferSize,
      maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
      maxTextureDimension2D: device.limits.maxTextureDimension2D,
      maxTextureDimension3D: device.limits.maxTextureDimension3D,
      maxComputeWorkgroupsPerDimension: device.limits.maxComputeWorkgroupsPerDimension,
    },
    device,
  };
}

/** Capability label suitable for UI/telemetry without overstating support. */
export function getWebGPUCapabilityLabel(status: WebGPUProbeStatus): string {
  switch (status) {
    case 'ready':
      return 'WebGPU device available; workload support must be validated separately';
    case 'adapter-unavailable':
      return 'WebGPU API available, but no adapter is available';
    case 'device-unavailable':
      return 'WebGPU adapter found, but device creation failed';
    case 'unsupported':
      return 'WebGPU unavailable; use a supported CPU or WebGL fallback';
  }
}
