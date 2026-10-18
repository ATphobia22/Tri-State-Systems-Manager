/**
 * tiles-3d-renderer-layer.ts — 3D Tiles 1.1 renderer for MapLibre GL JS.
 *
 * Integrates NASA JPL's 3d-tiles-renderer (Apache-2.0) with MapLibre via
 * @dvt3d/maplibre-three-plugin's MapScene, with RTC (Relative-To-Center)
 * coordinate handling for 32-bit float precision.
 *
 * Research basis: mapping-planes-lod-integration-20261018-0426
 * - 3D Tiles 1.1: RTC center in glTF root-node translation (double precision)
 * - Renderer handles double-precision internally; GPU sees only small relatives
 * - PBR/IBL via three.js PMREMGenerator + RoomEnvironment (procedural HDR)
 * - 5D state-word decoding helpers are experimental; metadata-to-attribute
 *   binding and renderer scheduling are not implemented by this layer.
 *
 * Resilient design: the layer accepts only supported HTTP(S) or local asset
 * URL forms, rejects unsupported schemes before invoking the loader, and
 * contains loader/render failures so already-loaded content remains visible.
 */

import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { MapScene } from '@dvt3d/maplibre-three-plugin';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { normalizeTilesetUrl } from './tileset-url';
export { normalizeTilesetUrl } from './tileset-url';

/** 5D state-word bit layout: B(3) D(3) C(3) T(4) S(3) = 16 bits */
export const STATE_WORD_BITS = {
  B: { offset: 0, mask: 0x7 },    // Boundary proxy: 0-7
  D: { offset: 3, mask: 0x7 },    // Geometric detail: 0-7
  C: { offset: 6, mask: 0x7 },    // Component complexity: 0-7
  T: { offset: 9, mask: 0xf },    // Texture appearance: 0-15
  S: { offset: 13, mask: 0x7 },   // Semantic depth: 0-7
} as const;

export type StateWordDimension = keyof typeof STATE_WORD_BITS;

/**
 * Decode one dimension from a 16-bit state word. O(1) bitwise operation.
 * Mirrors the GLSL decode in the shader chunk (must stay in sync).
 */
export function decodeStateWord(word: number, dim: StateWordDimension): number {
  const { offset, mask } = STATE_WORD_BITS[dim];
  return (word >> offset) & mask;
}

/**
 * XOR-diff two state words. Non-zero result = dimensions that changed.
 * Used for incremental update scheduling (only fetch changed chunks).
 */
export function diffStateWords(prev: number, next: number): number {
  return prev ^ next;
}

/**
 * Check if a specific dimension changed between two state words.
 */
export function didDimensionChange(prev: number, next: number, dim: StateWordDimension): boolean {
  const { offset, mask } = STATE_WORD_BITS[dim];
  return (((prev ^ next) >> offset) & mask) !== 0;
}

export interface Tiles3DRendererLayerConfig {
  id: string;
  /** Absolute http(s) URL or relative path to tileset.json */
  tilesetUrl: string;
  /** Enable PBR image-based lighting via procedural RoomEnvironment. Default true. */
  enableIBL?: boolean;
  /** IBL environment intensity. Default 1.0. */
  iblIntensity?: number;
  /** Maximum SSE (screen-space error) for refinement. Passed to renderer. */
  maxSse?: number;
}

/**
 * MapLibre custom layer hosting a 3d-tiles-renderer TilesRenderer.
 * Uses MapScene from the plugin for camera sync; RTC handled by the renderer.
 */
export class Tiles3DRendererLayer implements maplibregl.CustomLayerInterface {
  readonly id: string;
  readonly type: 'custom' = 'custom';
  readonly renderingMode: '3d' = '3d';

  private mapScene: MapScene | null = null;
  private map: maplibregl.Map | null = null;
  private tilesRenderer: TilesRenderer | null = null;
  private readonly handleTilesChanged = (): void => {
    // TilesRenderer loads asynchronously. Request another MapLibre frame when
    // the tileset/model arrives; otherwise a static map can remain stale until
    // the user pans or zooms.
    this.map?.triggerRepaint();
  };
  private pmrem: THREE.PMREMGenerator | null = null;
  private readonly config: Required<Omit<Tiles3DRendererLayerConfig, 'id' | 'tilesetUrl'>> &
    Pick<Tiles3DRendererLayerConfig, 'id' | 'tilesetUrl'>;

  constructor(config: Tiles3DRendererLayerConfig) {
    this.id = config.id;
    this.config = {
      ...config,
      enableIBL: config.enableIBL ?? true,
      iblIntensity: config.iblIntensity ?? 1.0,
      maxSse: config.maxSse ?? 16,
    };
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    // Reject unsupported URL schemes and ambiguous URL forms before loading.
    this.map = map;
    const url = normalizeTilesetUrl(this.config.tilesetUrl);
    if (url === null) {
      console.warn(`[Tiles3D] Rejected unsafe tileset URL: ${this.config.tilesetUrl}`);
      return;
    }
    if (url !== this.config.tilesetUrl) {
      console.info(`[Tiles3D] Normalized tileset URL: ${this.config.tilesetUrl} -> ${url}`);
    }
    try {
      // MapScene syncs the three.js camera with MapLibre's camera.
      this.mapScene = new MapScene(map as never, {
        enablePostProcessing: false,
      });

      const scene = this.mapScene.scene as THREE.Scene;

      // PBR image-based lighting: procedural RoomEnvironment, no external HDR.
      // Gives every PBR material (including GLTF-loaded) realistic ambient.
      if (this.config.enableIBL) {
        const renderer = this.mapScene.renderer as THREE.WebGLRenderer;
        this.pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        scene.environmentIntensity = this.config.iblIntensity;
      }

      // 3D Tiles renderer. Handles RTC_CENTER / root-node translation
      // internally in double precision; GPU sees small relative positions.
      this.tilesRenderer = new TilesRenderer(url);
      this.tilesRenderer.errorTarget = this.config.maxSse;
      this.tilesRenderer.addEventListener('load-tileset', this.handleTilesChanged);
      this.tilesRenderer.addEventListener('load-model', this.handleTilesChanged);
      scene.add(this.tilesRenderer.group as unknown as THREE.Object3D);
    } catch (err) {
      console.warn('[Tiles3D] Failed to initialize layer:', err);
      this.mapScene = null;
      this.map = null;
      this.tilesRenderer = null;
    }
  }

  render(_gl: WebGLRenderingContext, _args: unknown): void {
    try {
      const ms = this.mapScene as unknown as {
        cameraSync?: { syncCamera?: () => void };
        camera?: THREE.PerspectiveCamera;
        scene?: THREE.Scene;
        renderer?: THREE.WebGLRenderer;
        render?: () => void;
      } | null;
      ms?.cameraSync?.syncCamera?.();
      const cam = ms?.camera;
      if (this.tilesRenderer && cam && ms?.renderer) {
        this.tilesRenderer.setCamera(cam);
        this.tilesRenderer.setResolutionFromRenderer(cam, ms.renderer);
        this.tilesRenderer.update();
      }
      ms?.render?.();
    } catch (err) {
      console.warn('[Tiles3D] Render error (suppressed):', err);
    }
  }

  onRemove(): void {
    try {
      this.tilesRenderer?.removeEventListener('load-tileset', this.handleTilesChanged);
      this.tilesRenderer?.removeEventListener('load-model', this.handleTilesChanged);
      this.tilesRenderer?.dispose();
      this.pmrem?.dispose();
      (this.mapScene?.scene as THREE.Scene | undefined)?.environment?.dispose?.();
    } catch {
      /* ignore teardown errors */
    }
    this.tilesRenderer = null;
    this.mapScene = null;
    this.map = null;
    this.pmrem = null;
  }
}

/**
 * Optional GLSL snippet for a future 5D state-word integration. This layer does
 * not attach it to tile materials or populate `aStateWord`; callers must supply
 * a validated metadata-to-attribute bridge before using this snippet.
 *
 * Usage:
 *   shader.vertexShader = shader.vertexShader
 *     .replace('#include <common>', '#include <common>\nattribute uint aStateWord;\n...')
 */
export const STATE_WORD_GLSL_DECODE = /* glsl */ `
  // 5D state-word decode: B(3) D(3) C(3) T(4) S(3)
  uint _sw = aStateWord;
  int swB = int((_sw >> 0u) & 0x7u);
  int swD = int((_sw >> 3u) & 0x7u);
  int swC = int((_sw >> 6u) & 0x7u);
  int swT = int((_sw >> 9u) & 0xFu);
  int swS = int((_sw >> 13u) & 0x7u);
`;
