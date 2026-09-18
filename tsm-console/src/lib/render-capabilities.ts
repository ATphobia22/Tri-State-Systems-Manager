export type RenderBackend = 'WEBGPU' | 'WEBGL2' | 'CANVAS_2D';

export interface RenderCapabilities {
  webgpu: boolean;
  webgl2: boolean;
  canvas2d: boolean;
  preferred: RenderBackend;
}

export function detectRenderCapabilities(
  input: {
    gpu?: unknown;
    getContext?: (contextId: string) => unknown;
  } = typeof navigator !== 'undefined'
    ? { gpu: (navigator as Navigator & { gpu?: unknown }).gpu, getContext: (id) => document.createElement('canvas').getContext(id) }
    : {},
): RenderCapabilities {
  const webgpu = Boolean(input.gpu);
  let webgl2 = false;
  let canvas2d = false;
  if (typeof input.getContext === 'function') {
    try { webgl2 = Boolean(input.getContext('webgl2')); } catch { webgl2 = false; }
    try { canvas2d = Boolean(input.getContext('2d')); } catch { canvas2d = false; }
  }
  return { webgpu, webgl2, canvas2d, preferred: webgpu ? 'WEBGPU' : webgl2 ? 'WEBGL2' : 'CANVAS_2D' };
}

export function renderFallbackMessage(capabilities: RenderCapabilities): string {
  if (capabilities.preferred === 'WEBGPU') return 'WebGPU acceleration available.';
  if (capabilities.preferred === 'WEBGL2') return 'WebGPU unavailable; using WebGL2-compatible rendering.';
  return 'WebGPU and WebGL2 unavailable; using 2D fallback rendering.';
}
