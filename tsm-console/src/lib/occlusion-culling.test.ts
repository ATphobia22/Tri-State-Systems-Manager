/**
 * Tests for occlusion-culling.ts.
 * Uses a fake IOcclusionBackend (no GL) plus the real fail-open fallback path.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OcclusionCuller, type IOcclusionBackend, type CullableRenderable } from '../lib/occlusion-culling';

class FakeBackend implements IOcclusionBackend {
  registered: THREE.Mesh[] = [];
  occluded = new Set<THREE.Mesh>();
  updateCalls = 0;
  disposed = false;

  registerRoot(root: THREE.Object3D): void {
    if (root instanceof THREE.Mesh && !this.registered.includes(root)) this.registered.push(root);
  }
  unregisterRoot(root: THREE.Object3D): void {
    this.registered = this.registered.filter((m) => m !== root);
    this.occluded.delete(root as THREE.Mesh);
  }
  isOccluded(mesh: THREE.Mesh): boolean {
    return this.occluded.has(mesh);
  }
  update(_camera: THREE.Camera): void {
    this.updateCalls++;
  }
  dispose(): void {
    this.disposed = true;
  }
}

function makeCuller(opts: { retestN?: number } = {}): { culler: OcclusionCuller; backend: FakeBackend } {
  const backend = new FakeBackend();
  const culler = new OcclusionCuller({} as WebGL2RenderingContext, {
    retestOccludedEveryNFrames: opts.retestN ?? 5,
    backendFactory: () => backend,
  });
  return { culler, backend };
}

function renderable(id: string, draw: () => void): CullableRenderable {
  return {
    id,
    bounds: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10)),
    draw,
  };
}

const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);

describe('OcclusionCuller', () => {
  it('draws everything when the GL backend is unavailable (fail-open fallback)', () => {
    const draws: string[] = [];
    // Empty object fails the controller capability check -> fallback.
    const culler = new OcclusionCuller({} as unknown as WebGL2RenderingContext);
    expect(culler.isFallback()).toBe(true);
    culler.add(renderable('a', () => draws.push('a')));
    culler.add(renderable('b', () => draws.push('b')));
    culler.update(camera, 0);
    culler.render();
    expect(draws).toEqual(['a', 'b']);
    const stats = culler.getStats();
    expect(stats.total).toBe(2);
    expect(stats.visible).toBe(2);
    expect(stats.fallback).toBe(true);
    culler.dispose();
  });

  it('culls an occluded object and skips its draw callback', () => {
    const { culler, backend } = makeCuller();
    const draw = vi.fn();
    culler.add(renderable('box', draw));
    culler.update(camera, 0);
    culler.render();
    expect(draw).toHaveBeenCalledTimes(1);

    // Backend reports the proxy occluded on the next pass.
    backend.occluded.add(backend.registered[0]);
    culler.update(camera, 1);
    expect(culler.isOccluded('box')).toBe(true);
    culler.render();
    expect(draw).toHaveBeenCalledTimes(1); // no additional draw
    expect(backend.registered).toHaveLength(0); // proxy unregistered: frees the query slot
    culler.dispose();
  });

  it('re-tests occluded objects every N frames', () => {
    const { culler, backend } = makeCuller({ retestN: 5 });
    const draw = vi.fn();
    culler.add(renderable('box', draw));
    culler.update(camera, 0);
    culler.render();
    expect(draw).toHaveBeenCalledTimes(1);
    backend.occluded.add(backend.registered[0]);
    culler.update(camera, 1); // becomes occluded at frame 1
    expect(culler.isOccluded('box')).toBe(true);
    culler.render();
    expect(draw).toHaveBeenCalledTimes(1); // no draw while occluded

    // Frames 2..5: still occluded, no re-probe yet.
    for (const f of [2, 3, 4, 5]) {
      culler.update(camera, f);
      expect(culler.isOccluded('box')).toBe(true);
      expect(backend.registered).toHaveLength(0);
    }
    // Frame 6: 6 - 1 >= 5 -> re-probed, fail-open while testing.
    culler.update(camera, 6);
    expect(backend.registered).toHaveLength(1);
    expect(culler.isOccluded('box')).toBe(false);
    culler.render();
    expect(draw.mock.calls.length).toBeGreaterThan(1);
    culler.dispose();
  });

  it('restores visibility when a re-probe passes', () => {
    const { culler, backend } = makeCuller({ retestN: 3 });
    culler.add(renderable('box', () => {}));
    culler.update(camera, 0);
    const firstProxy = backend.registered[0];
    backend.occluded.add(firstProxy);
    culler.update(camera, 1);
    expect(culler.isOccluded('box')).toBe(true);

    culler.update(camera, 4); // re-probed (4-1 >= 3)
    expect(culler.isOccluded('box')).toBe(false);
    // Backend now reports visible: stays visible on subsequent frames.
    culler.update(camera, 5);
    expect(culler.isOccluded('box')).toBe(false);
    culler.dispose();
  });

  it('syncs proxy transforms from Box3 and Sphere bounds', () => {
    const { culler, backend } = makeCuller();
    culler.add({
      id: 'box',
      bounds: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 6, 8)),
      draw: () => {},
    });
    culler.add({
      id: 'sphere',
      bounds: new THREE.Sphere(new THREE.Vector3(100, 0, 0), 5),
      draw: () => {},
    });
    culler.update(camera, 0);
    expect(backend.registered).toHaveLength(2);
    const [boxProxy, sphereProxy] = backend.registered;
    // Box3(0..4, 0..6, 0..8): center (2,3,4), scale (4,6,8).
    expect(boxProxy.position.toArray()).toEqual([2, 3, 4]);
    expect(boxProxy.scale.toArray()).toEqual([4, 6, 8]);
    // Sphere(center 100,0,0, r=5): scale 10 on each axis.
    expect(sphereProxy.position.toArray()).toEqual([100, 0, 0]);
    expect(sphereProxy.scale.toArray()).toEqual([10, 10, 10]);
    culler.dispose();
  });

  it('remove() stops tracking and drawing', () => {
    const { culler, backend } = makeCuller();
    const draw = vi.fn();
    culler.add(renderable('box', draw));
    culler.update(camera, 0);
    culler.remove('box');
    expect(backend.registered).toHaveLength(0);
    culler.render();
    expect(draw).not.toHaveBeenCalled();
    expect(culler.getStats().total).toBe(0);
    culler.dispose();
  });

  it('rejects duplicate ids and invalid retest cadence', () => {
    const { culler } = makeCuller();
    culler.add(renderable('a', () => {}));
    expect(() => culler.add(renderable('a', () => {}))).toThrow(/duplicate/);
    expect(
      () => new OcclusionCuller({} as WebGL2RenderingContext, { retestOccludedEveryNFrames: 0 }),
    ).toThrow(RangeError);
    culler.dispose();
  });

  it('a throwing draw callback does not break the frame', () => {
    const { culler } = makeCuller();
    const good = vi.fn();
    culler.add({ id: 'bad', bounds: new THREE.Box3(), draw: () => { throw new Error('boom'); } });
    culler.add(renderable('good', good));
    expect(() => culler.render()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    // Second render: the bad callback warns only once, good still runs.
    expect(() => culler.render()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(2);
    culler.dispose();
  });
});
