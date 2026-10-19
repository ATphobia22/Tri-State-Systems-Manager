/**
 * WebGPU device bootstrap for TSM Nanite / H-Z plane.
 * Plans against spec-minimum limits; optionally raises after adapter query.
 *
 * @see docs/research/WEBGPU-COMPUTE-LIMITS-AND-NANITE-PLAN-2026-10-19.md
 */

/** Spec-guaranteed floors — safe on every conformant adapter. */
export const WEBGPU_PORTABLE_LIMITS = {
  maxStorageBufferBindingSize: 134217728,
  maxBufferSize: 268435456,
  maxComputeWorkgroupStorageSize: 16384,
  maxComputeInvocationsPerWorkgroup: 256,
  maxComputeWorkgroupSizeX: 256,
  maxComputeWorkgroupSizeY: 256,
  maxComputeWorkgroupSizeZ: 64,
  maxComputeWorkgroupsPerDimension: 65535,
  maxStorageBuffersPerShaderStage: 8,
} as const;

/** Recommended workgroup size for general compute (WebGPU Fundamentals). */
export const RECOMMENDED_WORKGROUP_SIZE = 64;

export type WebGpuSupport =
  | { ok: true; adapter: GPUAdapter; device: GPUDevice; limits: GPUSupportedLimits; features: string[] }
  | { ok: false; reason: string };

export interface RequestDeviceOptions {
  /** Prefer higher storage buffer binding when adapter allows (capped). */
  preferLargeStorage?: boolean;
  /** Label for GPUDevice. */
  label?: string;
}

function isWebGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

/**
 * Request adapter + device. Never throws for missing WebGPU — returns ok:false.
 */
export async function requestTsmWebGpuDevice(
  options: RequestDeviceOptions = {},
): Promise<WebGpuSupport> {
  if (!isWebGpuAvailable()) {
    return { ok: false, reason: 'navigator.gpu unavailable (use Chrome/Edge or fail open to MapLibre)' };
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu!.requestAdapter({
      powerPreference: 'high-performance',
    });
  } catch (e) {
    return { ok: false, reason: `requestAdapter failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!adapter) {
    return { ok: false, reason: 'No GPUAdapter (blocked, software-only, or unsupported)' };
  }

  const requiredLimits: Record<string, number> = {};
  // Stay within adapter capabilities; never request above adapter.limits
  const al = adapter.limits;
  requiredLimits.maxStorageBufferBindingSize = Math.min(
    al.maxStorageBufferBindingSize,
    options.preferLargeStorage
      ? al.maxStorageBufferBindingSize
      : WEBGPU_PORTABLE_LIMITS.maxStorageBufferBindingSize,
  );
  requiredLimits.maxBufferSize = Math.min(al.maxBufferSize, WEBGPU_PORTABLE_LIMITS.maxBufferSize);
  // Chrome may allow 10 storage buffers; request min(adapter, 10) when available
  if (al.maxStorageBuffersPerShaderStage > WEBGPU_PORTABLE_LIMITS.maxStorageBuffersPerShaderStage) {
    requiredLimits.maxStorageBuffersPerShaderStage = Math.min(al.maxStorageBuffersPerShaderStage, 10);
  }

  try {
    const device = await adapter.requestDevice({
      label: options.label ?? 'tsm-webgpu-nanite',
      requiredLimits,
    });
    device.lost.then((info) => {
      console.warn('[TSM WebGPU] device lost:', info.message);
    });
    return {
      ok: true,
      adapter,
      device,
      limits: device.limits,
      features: [...adapter.features],
    };
  } catch (e) {
    // Retry with no raised limits
    try {
      const device = await adapter.requestDevice({ label: options.label ?? 'tsm-webgpu-nanite-portable' });
      return {
        ok: true,
        adapter,
        device,
        limits: device.limits,
        features: [...adapter.features],
      };
    } catch (e2) {
      return {
        ok: false,
        reason: `requestDevice failed: ${e2 instanceof Error ? e2.message : String(e2)}`,
      };
    }
  }
}

/** True when env flag enables experimental Nanite plane. */
export function isNanitePlaneEnabled(): boolean {
  try {
    // Vite injects import.meta.env
    const env = (import.meta as { env?: Record<string, string> }).env;
    return env?.VITE_TSM_WEBGPU_NANITE === '1' || env?.VITE_TSM_WEBGPU_NANITE === 'true';
  } catch {
    return false;
  }
}

export function snapshotLimits(limits: GPUSupportedLimits): Record<string, number> {
  return {
    maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
    maxBufferSize: limits.maxBufferSize,
    maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
    maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
    maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
    maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY,
    maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ,
    maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
    maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage,
  };
}
