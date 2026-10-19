/**
 * world/renderer.ts — WebGL renderer + scene scaffold for the flood simulator.
 *
 * PLATFORM RULES (do not relax):
 * - WebGL is the preferred 3D renderer. If context creation fails, this
 *   module paints an explicit 2D status message and returns null so the
 *   surrounding map and controls remain usable. It never fabricates terrain.
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
): FloodRenderer | null {
  let spec = QUALITY_TIERS[initialTier];
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = buildRenderer(canvas, spec);
  } catch (error) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const width = Math.max(1, canvas.clientWidth || canvas.width || 640);
      const height = Math.max(1, canvas.clientHeight || canvas.height || 360);
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = '#101c2a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('3D flood view unavailable', width / 2, height / 2 - 10);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('WebGL could not initialize. The base map remains available.', width / 2, height / 2 + 18);
    }
    console.warn('[flood-sim-renderer] 3D rendering unavailable; kept map usable.', error);
    return null;
  }

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
        try {
          const replacement = buildRenderer(canvas, next);
          replacement.setSize(size.x, size.y, false);
          replacement.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2, next.pixelRatioCap));
          renderer = replacement;
          api.renderer = replacement;
          old.dispose();
        } catch (error) {
          console.warn('[flood-sim-renderer] Quality rebuild failed; retaining previous renderer.', error);
          return;
        }
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
