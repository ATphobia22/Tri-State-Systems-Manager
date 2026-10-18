/**
 * occlusion-culling.ts — WebGL2 occlusion-query culling with a renderable API.
 *
 * The actual GL query machinery lives in the existing
 * WebGL2DepthOcclusionController (webgl2-depth-occlusion.ts): it renders
 * bounding volumes depth-only (color masked off) against the depth buffer the
 * map has already written, and polls ANY_SAMPLES_PASSED_CONSERVATIVE results
 * asynchronously — QUERY_RESULT is only read after QUERY_RESULT_AVAILABLE, so
 * the CPU never stalls waiting for the GPU.
 *
 * This module adds the API the integration needs:
 * - renderables described by world-space bounds (THREE.Box3 | THREE.Sphere)
 *   plus a draw callback, instead of raw three.js meshes;
 * - per-object retest cadence: occluded objects stop consuming query slots
 *   and are re-probed every N frames (default 5) to handle camera movement;
 * - fail-open fallback: when occlusion queries are unavailable, everything
 *   renders and a single warning is logged.
 *
 * This is per-object occlusion culling, NOT hierarchical-Z. H-Z needs GPU
 * compute (WebGPU), which MapLibre does not yet expose.
 */

import * as THREE from 'three';
import { WebGL2DepthOcclusionController } from './webgl2-depth-occlusion';

/** Minimal backend surface; WebGL2DepthOcclusionController satisfies it. */
export interface IOcclusionBackend {
  registerRoot(root: THREE.Object3D): void;
  unregisterRoot(root: THREE.Object3D): void;
  isOccluded(mesh: THREE.Mesh): boolean;
  update(camera: THREE.Camera): void;
  dispose(): void;
}

export interface CullableRenderable {
  /** Stable id, unique within the culler. */
  id: string;
  /** World-space bounding volume used for the occlusion probe. */
  bounds: THREE.Box3 | THREE.Sphere;
  /** Renders the object; called only when it is not culled. */
  draw: () => void;
}

export interface OcclusionCullerOptions {
  /**
   * Occluded objects are re-probed every N frames. Default 5. Must be >= 1.
   * Visible objects are probed continuously (round-robin) by the backend.
   */
  retestOccludedEveryNFrames?: number;
  /** Max probe queries issued per frame. Default 64. */
  maxQueriesPerFrame?: number;
  /** Cap on tracked objects; overflow renders unconditionally. Default 2048. */
  maxTrackedObjects?: number;
  /** Test seam: inject a fake backend instead of the real GL controller. */
  backendFactory?: (gl: WebGL2RenderingContext) => IOcclusionBackend;
}

interface TrackedRenderable {
  spec: CullableRenderable;
  /** Proxy mesh registered with the backend; null while occluded (not probed). */
  proxy: THREE.Mesh | null;
  occluded: boolean;
  occludedSinceFrame: number;
  drawWarned: boolean;
}

const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const proxyMaterial = new THREE.MeshBasicMaterial();

function syncProxyTransform(proxy: THREE.Mesh, bounds: THREE.Box3 | THREE.Sphere): void {
  const box =
    bounds instanceof THREE.Box3
      ? bounds
      : new THREE.Box3().setFromCenterAndSize(
          bounds.center,
          new THREE.Vector3(bounds.radius * 2, bounds.radius * 2, bounds.radius * 2),
        );
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  proxy.position.copy(center);
  // Guard against degenerate bounds collapsing the probe to nothing.
  proxy.scale.set(Math.max(size.x, 1e-3), Math.max(size.y, 1e-3), Math.max(size.z, 1e-3));
  proxy.updateMatrixWorld(true);
}

export class OcclusionCuller {
  private readonly retestN: number;
  private readonly proxyRoot = new THREE.Group();
  private readonly tracked = new Map<string, TrackedRenderable>();
  private backend: IOcclusionBackend | null = null;
  private fallback = false;
  private fallbackWarned = false;
  private disposed = false;

  constructor(gl: WebGL2RenderingContext, options: OcclusionCullerOptions = {}) {
    const retestN = options.retestOccludedEveryNFrames ?? 5;
    if (!Number.isInteger(retestN) || retestN < 1) {
      throw new RangeError('retestOccludedEveryNFrames must be a positive integer');
    }
    this.retestN = retestN;
    try {
      this.backend = options.backendFactory
        ? options.backendFactory(gl)
        : new WebGL2DepthOcclusionController(gl, {
            maxQueriesPerFrame: options.maxQueriesPerFrame,
            maxTrackedMeshes: options.maxTrackedObjects,
          });
    } catch (error) {
      // Fail open: without queries everything renders; log once.
      this.fallback = true;
      if (!this.fallbackWarned) {
        this.fallbackWarned = true;
        console.warn('[OcclusionCuller] occlusion queries unavailable — rendering everything:', error);
      }
    }
  }

  /** True when running in fail-open fallback mode (no GL queries). */
  isFallback(): boolean {
    return this.fallback;
  }

  add(renderable: CullableRenderable): void {
    if (this.disposed) return;
    if (this.tracked.has(renderable.id)) {
      throw new Error(`[OcclusionCuller] duplicate renderable id: ${renderable.id}`);
    }
    const entry: TrackedRenderable = {
      spec: renderable,
      proxy: null,
      occluded: false,
      occludedSinceFrame: 0,
      drawWarned: false,
    };
    this.tracked.set(renderable.id, entry);
    // New objects start visible (fail-open) and are probed immediately.
    this.registerProxy(entry);
  }

  remove(id: string): void {
    const entry = this.tracked.get(id);
    if (!entry) return;
    this.unregisterProxy(entry);
    this.tracked.delete(id);
  }

  clear(): void {
    for (const id of [...this.tracked.keys()]) this.remove(id);
  }

  isOccluded(id: string): boolean {
    return this.tracked.get(id)?.occluded ?? false;
  }

  getStats(): { total: number; visible: number; occluded: number; fallback: boolean } {
    let visible = 0;
    let occluded = 0;
    for (const t of this.tracked.values()) {
      if (t.occluded) occluded++;
      else visible++;
    }
    return { total: this.tracked.size, visible, occluded, fallback: this.fallback };
  }

  /**
   * Run one culling pass. `frame` must be monotonic non-decreasing.
   * Polls previous-frame query results, issues new probes, and applies the
   * retest cadence to occluded objects.
   */
  update(camera: THREE.Camera, frame: number): void {
    if (this.disposed || this.fallback || !this.backend) return;
    // Re-probe occluded objects whose retest interval has elapsed.
    for (const entry of this.tracked.values()) {
      if (entry.occluded && frame - entry.occludedSinceFrame >= this.retestN) {
        entry.occluded = false; // fail-open while the new probe is in flight
        this.registerProxy(entry);
      }
      if (entry.proxy) syncProxyTransform(entry.proxy, entry.spec.bounds);
    }
    this.backend.update(camera);
    // Apply fresh results: newly occluded objects stop consuming query slots.
    for (const entry of this.tracked.values()) {
      if (entry.proxy && this.backend.isOccluded(entry.proxy)) {
        entry.occluded = true;
        entry.occludedSinceFrame = frame;
        this.unregisterProxy(entry);
      }
    }
  }

  /** Draw every renderable that is not currently culled. */
  render(): void {
    if (this.disposed) return;
    for (const entry of this.tracked.values()) {
      if (entry.occluded) continue;
      try {
        entry.spec.draw();
      } catch (error) {
        // One bad draw callback must not kill the frame; warn once per id.
        if (!entry.drawWarned) {
          entry.drawWarned = true;
          console.warn(`[OcclusionCuller] draw callback failed for "${entry.spec.id}":`, error);
        }
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    try {
      this.backend?.dispose();
    } catch {
      /* context may already be lost */
    }
    this.backend = null;
  }

  private registerProxy(entry: TrackedRenderable): void {
    if (!this.backend || entry.proxy) return;
    const proxy = new THREE.Mesh(unitBoxGeometry, proxyMaterial);
    // Proxies live in a private scene that is never rendered; they exist only
    // so the backend can compute world-space bounds and track queries.
    proxy.visible = false;
    syncProxyTransform(proxy, entry.spec.bounds);
    this.proxyRoot.add(proxy);
    this.backend.registerRoot(proxy);
    entry.proxy = proxy;
  }

  private unregisterProxy(entry: TrackedRenderable): void {
    if (!this.backend || !entry.proxy) return;
    try {
      this.backend.unregisterRoot(entry.proxy);
    } catch {
      /* best effort during teardown */
    }
    this.proxyRoot.remove(entry.proxy);
    entry.proxy = null;
  }
}
