/**
 * Cross-device validation harness — desktop + mobile representatives.
 * Real GPU/memory numbers require operator hardware.
 * PENDING_OPERATOR in CI; never fabricate FPS/memory.
 */

export type DeviceClass = 'desktop-discrete' | 'desktop-integrated' | 'mobile-high' | 'mobile-mid';

export interface DeviceProfile {
  readonly id: string;
  readonly class: DeviceClass;
  readonly label: string;
  readonly os: string;
  readonly gpuHint: string;
  readonly maxTextureSizeHint: number;
  readonly memoryBudgetMbHint: number;
}

export interface DeviceMeasurement {
  readonly deviceId: string;
  readonly measuredAt: string | null;
  readonly status: 'MEASURED' | 'PENDING_OPERATOR' | 'UNSUPPORTED' | 'FAILED';
  readonly webgpu: boolean | null;
  readonly webgl2: boolean | null;
  readonly peakMemoryMb: number | null;
  readonly hizBuildMs: number | null;
  readonly terrainFrameMs: number | null;
  readonly seamCheckMs: number | null;
  readonly renderCorrectnessPass: boolean | null;
  readonly notes: string;
}

export interface CrossDeviceValidationReport {
  readonly schema_version: string;
  readonly generated_at: string;
  readonly matrix: readonly DeviceProfile[];
  readonly measurements: readonly DeviceMeasurement[];
  readonly correctness: {
    readonly hizCpuParity: boolean;
    readonly transvoxelSeams: boolean;
    readonly coverageFailClosed: boolean;
    readonly crsReportGenerated: boolean;
  };
  readonly allDevicesMeasured: boolean;
  readonly authority: 'VALIDATION_REPORT';
  readonly policy: string;
}

export const REPRESENTATIVE_DEVICE_MATRIX: readonly DeviceProfile[] = [
  { id: 'desktop-nvidia-class', class: 'desktop-discrete', label: 'Desktop discrete GPU (NVIDIA/AMD class)', os: 'Windows 11 / Linux', gpuHint: 'Discrete WebGPU', maxTextureSizeHint: 16384, memoryBudgetMbHint: 4096 },
  { id: 'desktop-intel-class', class: 'desktop-integrated', label: 'Desktop integrated GPU', os: 'Windows 11 / macOS', gpuHint: 'Integrated WebGPU/WebGL2', maxTextureSizeHint: 8192, memoryBudgetMbHint: 1024 },
  { id: 'mobile-ios-class', class: 'mobile-high', label: 'iPhone / iPad class (Safari)', os: 'iOS / iPadOS', gpuHint: 'Metal via WebKit (WebGPU where available)', maxTextureSizeHint: 4096, memoryBudgetMbHint: 512 },
  { id: 'mobile-android-class', class: 'mobile-mid', label: 'Android mid/high (Chrome)', os: 'Android', gpuHint: 'Vulkan/GLES WebGPU/WebGL2', maxTextureSizeHint: 4096, memoryBudgetMbHint: 512 },
];

export function emptyMeasurement(deviceId: string, notes: string): DeviceMeasurement {
  return { deviceId, measuredAt: null, status: 'PENDING_OPERATOR', webgpu: null, webgl2: null, peakMemoryMb: null, hizBuildMs: null, terrainFrameMs: null, seamCheckMs: null, renderCorrectnessPass: null, notes };
}

export function buildCrossDeviceValidationReport(input: {
  hizCpuParity: boolean; transvoxelSeams: boolean; coverageFailClosed: boolean; crsReportGenerated: boolean; measurements?: readonly DeviceMeasurement[];
}): CrossDeviceValidationReport {
  const measurements = input.measurements ?? REPRESENTATIVE_DEVICE_MATRIX.map((d) => emptyMeasurement(d.id, 'No live device attached in CI/sandbox. Operator must run harness on hardware.'));
  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    matrix: REPRESENTATIVE_DEVICE_MATRIX,
    measurements,
    correctness: { hizCpuParity: input.hizCpuParity, transvoxelSeams: input.transvoxelSeams, coverageFailClosed: input.coverageFailClosed, crsReportGenerated: input.crsReportGenerated },
    allDevicesMeasured: measurements.every((m) => m.status === 'MEASURED'),
    authority: 'VALIDATION_REPORT',
    policy: 'Human authority remains final. Do not fabricate FPS/memory. PENDING_OPERATOR is the honest CI state without hardware.',
  };
}

export function recordDeviceMeasurement(
  partial: Omit<DeviceMeasurement, 'status'> & { status?: DeviceMeasurement['status'] },
): DeviceMeasurement {
  if (partial.peakMemoryMb != null && !(partial.peakMemoryMb >= 0)) throw new Error('peakMemoryMb must be >= 0 when provided');
  return { ...partial, status: partial.status ?? 'MEASURED', measuredAt: partial.measuredAt ?? new Date().toISOString() };
}
