/**
 * maplibre-three-layer.ts — reusable Three.js custom layer for MapLibre GL JS.
 *
 * Lets real 3D objects (structures, flood-control hardware, detailed spatial
 * models) render photorealistically inside the MapLibre map, aligned to the
 * Terrain-RGB surface. The layer shares MapLibre's WebGL context and camera:
 * `renderingMode: '3d'` keeps Three.js geometry depth-sorted against the
 * native terrain mesh.
 *
 * Infrastructure only: this module is not attached to any route. Scene
 * content comes from caller-supplied builder functions — there are no
 * placeholder or demo meshes. An empty content list renders an empty scene.
 *
 * Graceful rendering policy:
 * - HDR / GLTF URLs must be absolute http(s); anything else is skipped.
 * - Loader failures and throwing content builders never propagate into the
 *   map render loop; the layer keeps rendering whatever loaded successfully.
 * - Nothing here invents geometry, elevations, or evidence. Human authority
 *   remains final.
 */

import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Builds scene content. Receives the layer's THREE.Scene; must not throw. */
export type ThreeSceneContentBuilder = (scene: THREE.Scene) => void;

export interface MapLibreThreeLayerDiagnostic {
  code: string;
  message: string;
}

export interface MapLibreThreeLayerConfig {
  /** MapLibre layer id. */
  id: string;
  /** [longitude, latitude] origin of the Three.js world. */
  origin: [number, number];
  /** Origin altitude in meters above the ellipsoid. Default 0. */
  altitudeMeters?: number;
  /**
   * Scene content builders. No placeholder/demo meshes are created by this
   * class; pass an empty array (or omit) to render an empty scene.
   */
  content?: ThreeSceneContentBuilder[];
  /** Optional absolute http(s) URL of an HDR equirectangular environment map. */
  hdrUrl?: string;
  /** Optional absolute http(s) URLs of GLTF/GLB models to place at the origin. */
  modelUrls?: string[];
  /** Optional non-throwing diagnostic sink for degraded rendering states. */
  onDiagnostic?: (diagnostic: MapLibreThreeLayerDiagnostic) => void;
  /** ACES tone-mapping exposure. Default 1.1. */
  exposure?: number;
  /** Shadow map resolution. Default 2048. */
  shadowMapSize?: number;
}

const DEFAULT_EXPOSURE = 1.1;
const DEFAULT_SHADOW_MAP_SIZE = 2048;
/** Half-extent, in meters, of the directional-light shadow camera. */
const SHADOW_CAMERA_EXTENT_METERS = 150;

export class MapLibreThreeLayer implements maplibregl.CustomLayerInterface {
  readonly id: string;
  readonly type: 'custom' = 'custom';
  readonly renderingMode: '3d' = '3d';

  private readonly origin: [number, number];
  private readonly altitudeMeters: number;
  private readonly contentBuilders: ThreeSceneContentBuilder[];
  private readonly hdrUrl?: string;
  private readonly modelUrls: string[];
  private readonly onDiagnostic?: (diagnostic: MapLibreThreeLayerDiagnostic) => void;
  private readonly diagnostics = new Map<string, string>();
  private readonly exposure: number;
  private readonly shadowMapSize: number;

  private map: maplibregl.Map | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();

  /** Mercator-space translation of the origin. */
  private readonly mercatorX: number;
  private readonly mercatorY: number;
  private readonly mercatorZ: number;
  /** Mercator units per meter at the origin (model scale factor). */
  private readonly mercatorScale: number;

  constructor(config: MapLibreThreeLayerConfig) {
    this.id = config.id;
    this.origin = config.origin;
    this.altitudeMeters = config.altitudeMeters ?? 0;
    this.contentBuilders = config.content ?? [];
    this.hdrUrl = config.hdrUrl;
    this.modelUrls = config.modelUrls ?? [];
    this.onDiagnostic = config.onDiagnostic;
    this.exposure = config.exposure ?? DEFAULT_EXPOSURE;
    this.shadowMapSize = config.shadowMapSize ?? DEFAULT_SHADOW_MAP_SIZE;

    const mercator = maplibregl.MercatorCoordinate.fromLngLat(
      { lng: this.origin[0], lat: this.origin[1] },
      this.altitudeMeters,
    );
    this.mercatorX = mercator.x;
    this.mercatorY = mercator.y;
    this.mercatorZ = mercator.z;
    this.mercatorScale = mercator.meterInMercatorCoordinateUnits();
  }

  /** Read-only diagnostics; presentation failures never propagate into MapLibre. */
  getDiagnostics(): MapLibreThreeLayerDiagnostic[] {
    return [...this.diagnostics.entries()].map(([code, message]) => ({ code, message }));
  }

  private reportDiagnostic(code: string, message: string): void {
    if (this.diagnostics.has(code)) return;
    this.diagnostics.set(code, message);
    try {
      this.onDiagnostic?.({ code, message });
    } catch {
      // A consumer's diagnostic callback must never break map rendering.
    }
  }

  /** Absolute http(s) URLs only — unsafe URLs are skipped and reported, never fetched. */
  private isLoadableUrl(value: unknown, kind: string): value is string {
    if (typeof value !== 'string' || value.length === 0) {
      this.reportDiagnostic(`invalid-${kind.toLowerCase()}-url`, `${kind} URL is missing or invalid; that optional layer was skipped.`);
      return false;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
    } catch {
      // Report the invalid URL below; parsing failure is expected for malformed input.
    }
    this.reportDiagnostic(`invalid-${kind.toLowerCase()}-url`, `${kind} URL must use absolute HTTP(S); that optional layer was skipped.`);
    return false;
  }

  onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext): void {
    this.map = map;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = this.exposure;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      const sun = new THREE.DirectionalLight(0xfff5ea, 2.5);
      sun.position.set(50, 100, 50);
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
      sun.shadow.camera.left = -SHADOW_CAMERA_EXTENT_METERS;
      sun.shadow.camera.right = SHADOW_CAMERA_EXTENT_METERS;
      sun.shadow.camera.top = SHADOW_CAMERA_EXTENT_METERS;
      sun.shadow.camera.bottom = -SHADOW_CAMERA_EXTENT_METERS;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 1000;
      this.scene.add(ambient, sun);
    } catch (error) {
      this.renderer = null;
      this.reportDiagnostic('renderer-init-failed', error instanceof Error ? error.message : 'WebGL renderer could not initialize.');
      return;
    }

    for (const build of this.contentBuilders) {
      try {
        build(this.scene);
      } catch (error) {
        this.reportDiagnostic(`content-builder-${this.contentBuilders.indexOf(build)}-failed`, error instanceof Error ? error.message : 'A scene content builder failed; remaining map layers are preserved.');
      }
    }

    if (this.isLoadableUrl(this.hdrUrl, 'HDR')) {
      this.loadEnvironment(this.hdrUrl);
    }
    for (const modelUrl of this.modelUrls) {
      if (this.isLoadableUrl(modelUrl, 'Model')) {
        this.loadModel(modelUrl);
      }
    }
  }

  private loadEnvironment(url: string): void {
    try {
      new RGBELoader().load(
        url,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.environment = texture;
        },
        undefined,
        () => {
          this.reportDiagnostic('hdr-load-failed', 'Environment map failed to load; rendering continues without image-based lighting.');
        },
      );
    } catch (error) {
      this.reportDiagnostic('hdr-loader-init-failed', error instanceof Error ? error.message : 'Environment-map loader could not initialize.');
    }
  }

  private loadModel(url: string): void {
    try {
      new GLTFLoader().load(
        url,
        (gltf) => {
          gltf.scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          this.scene.add(gltf.scene);
        },
        undefined,
        () => {
          // The model is added only after a successful load.
        },
      );
    } catch (error) {
      this.reportDiagnostic(`model-loader-init-failed-${this.modelUrls.indexOf(url)}`, error instanceof Error ? error.message : 'Model loader could not initialize.');
    }
  }

  render(_gl: WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput): void {
    if (!this.renderer || !this.map) return;

    // Compose the model matrix: translate to the Mercator origin, scale
    // meters into Mercator coordinate units, then rotate Z-up into
    // Mercator space; the map camera matrix goes on the left.
    try {
      const rotationX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      const scale = new THREE.Matrix4().makeScale(
        this.mercatorScale,
        -this.mercatorScale,
        this.mercatorScale,
      );
      const translation = new THREE.Matrix4().makeTranslation(
        this.mercatorX,
        this.mercatorY,
        this.mercatorZ,
      );
      const cameraMatrix = new THREE.Matrix4().fromArray(
        Array.from(options.modelViewProjectionMatrix),
      );
      this.camera.projectionMatrix
        .copy(cameraMatrix)
        .multiply(translation)
        .multiply(scale)
        .multiply(rotationX);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();

      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint();
    } catch (error) {
      this.reportDiagnostic('render-failed', error instanceof Error ? error.message : '3D layer render failed; the base map remains usable.');
      this.renderer = null;
    }
  }

  onRemove(_map: maplibregl.Map, _gl: WebGL2RenderingContext): void {
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose();
        } else {
          material?.dispose();
        }
      }
    });
    this.scene.clear();
    // Releases Three.js GL state; the canvas/context itself belongs to MapLibre.
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }
}
