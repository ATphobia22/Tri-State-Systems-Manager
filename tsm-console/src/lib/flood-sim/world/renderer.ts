/**
 * world/renderer.ts — WebGL renderer + scene scaffold for the flood simulator.
 *
 * PLATFORM RULES (do not relax):
 * - Pure WebGL (THREE.WebGLRenderer) only. WebGPU (`navigator.gpu`,
 *   `src/gpu/`) is NOT iOS-safe under the Capacitor WKWebView target, so
 *   this module never touches it — no feature-detect, no fallback branch,
 *   just WebGL. If WebGL context creation fails, the module throws a clear
 *   error instead of silently degrading to a blank canvas.
 * - ACESFilmicToneMapping for the Hollywood grade (task requirement).
 * - Device-pixel-ratio capped at 2, following the existing
 *   `ThreeGeospatialHarness` pattern.
 *
 * Quality tiers scale pixel ratio, antialiasing, water shader detail, and
 * terrain/water mesh density. Changing antialias requires a renderer
 * rebuild; `applyQuality()` handles that internally on the same canvas.
 */

import * as THREE from 'three';

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityTierSpec {
  tier: QualityTier;
  /** Pixel-ratio cap (devicePixelRatio is additionally capped at 2). */
  pixelRatioCap: number;
  antialias: boolean;
  /** Terrain plane segments per side. */
  terrainSegments: number;
  /** Water plane segments per side. */
  waterSegments: number;
  /** Water shader ripple-detail multiplier. */
  waterDetail: number;
  label: string;
}

export const QUALITY_TIERS: Record<QualityTier, QualityTierSpec> = {
  low: {
    tier: 'low',
    pixelRatioCap: 1,
    antialias: false,
    terrainSegments: 64,
    waterSegments: 48,
    waterDetail: 0.4,
    label: 'Low — integrated GPUs / older iPhones',
  },
  medium: {
    tier: 'medium',
    pixelRatioCap: 1.5,
    antialias: true,
    terrainSegments: 128,
    waterSegments: 96,
    waterDetail: 0.8,
    label: 'Medium — default for desktop + modern iPhone',
  },
  high: {
    tier: 'high',
    pixelRatioCap: 2,
    antialias: true,
    terrainSegments: 192,
    waterSegments: 144,
    waterDetail: 1.2,
    label: 'High — discrete GPUs',
  },
  ultra: {
    tier: 'ultra',
    pixelRatioCap: 2,
    antialias: true,
    terrainSegments: 256,
    waterSegments: 192,
    waterDetail: 1.8,
    label: 'Ultra — workstation preview (still real-time, not path traced)',
  },
};

export const QUALITY_TIER_ORDER: QualityTier[] = ['low', 'medium', 'high', 'ultra'];

/** Default sun direction shared by the water shader and scene lights. */
export const DEFAULT_SUN_DIRECTION = new THREE.Vector3(-0.45, 0.62, 0.35).normalize();

export interface FloodRenderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  tier: QualityTier;
  spec: QualityTierSpec;
  applyQuality(tier: QualityTier): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

function buildRenderer(canvas: HTMLCanvasElement, spec: QualityTierSpec): THREE.WebGLRenderer {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: spec.antialias, alpha: false });
  } catch (err) {
    throw new Error(
      `[flood-sim-renderer] WebGL context creation failed: ${err instanceof Error ? err.message : String(err)}. ` +
        'The flood simulator requires WebGL; it never falls back to WebGPU.',
    );
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const dpr = Math.min(window.devicePixelRatio || 1, 2, spec.pixelRatioCap);
  renderer.setPixelRatio(dpr);
  return renderer;
}

/**
 * Create the renderer + scene scaffold on an existing canvas element.
 * Scene contents (terrain, water, markers) are added by the caller.
 */
export function createFloodRenderer(
  canvas: HTMLCanvasElement,
  initialTier: QualityTier = 'medium',
): FloodRenderer {
  let spec = QUALITY_TIERS[initialTier];
  let renderer = buildRenderer(canvas, spec);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9db4c6);
  // Exponential fog for aerial depth cueing (water shader implements it manually).
  scene.fog = new THREE.FogExp2(0xbdcbd6, 0.00012);

  const camera = new THREE.PerspectiveCamera(55, 1, 10, 600_000);

  const hemi = new THREE.HemisphereLight(0xcfe4f7, 0x4a5a43, 0.85);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
  sun.position.copy(DEFAULT_SUN_DIRECTION).multiplyScalar(100_000);
  scene.add(hemi, sun);

  const api: FloodRenderer = {
    renderer,
    scene,
    camera,
    tier: initialTier,
    spec,
    applyQuality(tier: QualityTier): void {
      const next = QUALITY_TIERS[tier];
      if (next.antialias !== api.spec.antialias) {
        // Antialias is fixed at context creation — rebuild on the same canvas.
        const old = api.renderer;
        const size = new THREE.Vector2();
        old.getSize(size);
        old.dispose();
        renderer = buildRenderer(canvas, next);
        api.renderer = renderer;
        api.resize(size.x, size.y);
      }
      spec = next;
      api.tier = tier;
      api.spec = next;
      const dpr = Math.min(window.devicePixelRatio || 1, 2, next.pixelRatioCap);
      api.renderer.setPixelRatio(dpr);
    },
    resize(width: number, height: number): void {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      api.renderer.setSize(width, height, false);
    },
    dispose(): void {
      api.renderer.dispose();
    },
  };

  return api;
}
