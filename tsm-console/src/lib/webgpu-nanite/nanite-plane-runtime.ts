/**
 * Nanite plane B runtime — device, camera, depth pyramid, meshlet import/cull.
 * SIMULATION_DEMO only. Never substitutes for MapLibre regulatory layers.
 */

import { buildDepthPyramidCpu } from './depth-pyramid';
import { mapLibreCameraToWebGpu, type MapLibreCameraState } from './maplibre-webgpu-camera';
import { cullMeshlets } from './meshlet-cull';
import { buildMeshletsGreedy, createUnitCubeMesh } from './meshlet-import';
import {
  isNanitePlaneEnabled,
  requestTsmWebGpuDevice,
  snapshotLimits,
  type WebGpuSupport,
} from './webgpu-device';

export type NanitePlaneStatus =
  | { phase: 'disabled' }
  | { phase: 'unsupported'; reason: string }
  | {
      phase: 'ready';
      limits: Record<string, number>;
      features: string[];
      pyramidLevels: number;
      cameraDistanceM: number;
      meshlets: {
        count: number;
        triangles: number;
        visible: number;
        culled: number;
        warnings: string[];
      };
      label: 'SIMULATION_DEMO';
    };

export interface NaniteSmokeInput {
  camera: MapLibreCameraState;
  depthProxy?: { data: Float32Array; width: number; height: number };
}

let cachedDevice: WebGpuSupport | null = null;

export async function probeNanitePlane(): Promise<WebGpuSupport | { ok: false; reason: string }> {
  if (!isNanitePlaneEnabled()) {
    return { ok: false, reason: 'VITE_TSM_WEBGPU_NANITE not enabled' };
  }
  if (cachedDevice?.ok) return cachedDevice;
  cachedDevice = await requestTsmWebGpuDevice({ preferLargeStorage: true });
  return cachedDevice;
}

export async function runNanitePlaneSmoke(input: NaniteSmokeInput): Promise<NanitePlaneStatus> {
  if (!isNanitePlaneEnabled()) {
    return { phase: 'disabled' };
  }

  const cam = mapLibreCameraToWebGpu(input.camera);
  const probe = await probeNanitePlane();

  const width = input.depthProxy?.width ?? 64;
  const height = input.depthProxy?.height ?? 64;
  let depth = input.depthProxy?.data;
  if (!depth) {
    depth = new Float32Array(width * height);
    for (let i = 0; i < depth.length; i++) depth[i] = (i % width) / width;
  }
  const pyramid = buildDepthPyramidCpu(depth, width, height);

  const imported = buildMeshletsGreedy(createUnitCubeMesh('tsm-smoke-cube'));
  const cull = cullMeshlets(imported.pack, cam);

  if (!probe.ok) {
    return { phase: 'unsupported', reason: probe.reason };
  }

  return {
    phase: 'ready',
    limits: snapshotLimits(probe.limits),
    features: probe.features,
    pyramidLevels: pyramid.levels.length,
    cameraDistanceM: cam.distanceM,
    meshlets: {
      count: imported.meshletCount,
      triangles: imported.triangleCount,
      visible: cull.visible.length,
      culled: cull.culled,
      warnings: imported.warnings,
    },
    label: 'SIMULATION_DEMO',
  };
}

export function resetNanitePlaneCache(): void {
  if (cachedDevice?.ok) {
    try {
      cachedDevice.device.destroy();
    } catch {
      /* already lost */
    }
  }
  cachedDevice = null;
}
