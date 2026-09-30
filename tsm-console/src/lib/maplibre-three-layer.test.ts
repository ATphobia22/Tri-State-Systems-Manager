/**
 * maplibre-three-layer.test.ts — vitest suite for the MapLibre Three.js
 * custom layer. maplibre-gl and three are mocked; the suite verifies the
 * Mercator transform math, matrix composition order, fail-closed URL
 * handling, and error-free rendering with an empty scene.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomRenderMethodInput, Map as MaplibreMap } from 'maplibre-gl';

const mocks = vi.hoisted(() => {
  const multiplyLog: string[] = [];
  const translationArgs: Array<[number, number, number]> = [];
  const scaleArgs: Array<[number, number, number]> = [];
  const renderCalls: Array<{ scene: unknown; camera: unknown }> = [];
  const addedToScene: unknown[] = [];
  const rgbeLoads: Array<{ url: string; onLoad: (t: unknown) => void; onError: () => void }> = [];
  const gltfLoads: Array<{ url: string; onLoad: (g: unknown) => void; onError: () => void }> = [];
  const fromLngLatCalls: Array<{ lngLat: unknown; altitude: unknown }> = [];
  let resetStateCalls = 0;
  let repaintCalls = 0;

  class FakeMatrix4 {
    tag = 'identity';
    fromArray() {
      this.tag = 'cameraMatrix';
      return this;
    }
    makeRotationX() {
      this.tag = 'rotationX';
      return this;
    }
    makeScale(x: number, y: number, z: number) {
      this.tag = 'scale';
      scaleArgs.push([x, y, z]);
      return this;
    }
    makeTranslation(x: number, y: number, z: number) {
      this.tag = 'translation';
      translationArgs.push([x, y, z]);
      return this;
    }
    multiply(other: FakeMatrix4) {
      multiplyLog.push(`${this.tag}*${other.tag}`);
      this.tag = `(${this.tag}*${other.tag})`;
      return this;
    }
    copy(other: FakeMatrix4) {
      this.tag = other.tag;
      return this;
    }
    invert() {
      return this;
    }
  }

  class FakeRenderer {
    autoClear = true;
    outputColorSpace: unknown = null;
    toneMapping: unknown = null;
    toneMappingExposure = 0;
    shadowMap = { enabled: false, type: null as unknown };
    constructor(_opts: unknown) {}
    resetState() {
      resetStateCalls++;
    }
    render(scene: unknown, camera: unknown) {
      renderCalls.push({ scene, camera });
    }
    dispose() {}
  }

  class FakeScene {
    environment: unknown = null;
    add(...objs: unknown[]) {
      addedToScene.push(...objs);
    }
    traverse() {}
    clear() {}
  }

  class FakeCamera {
    projectionMatrix = new FakeMatrix4();
    projectionMatrixInverse = new FakeMatrix4();
  }

  class FakeAmbientLight {
    constructor(
      public color: unknown,
      public intensity: unknown,
    ) {}
  }

  class FakeDirectionalLight {
    position = { set: () => {} };
    castShadow = false;
    shadow = {
      mapSize: { set: () => {} },
      camera: { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0 },
    };
    constructor(
      public color: unknown,
      public intensity: unknown,
    ) {}
  }

  class FakeRGBELoader {
    load(url: string, onLoad: (t: unknown) => void, _p?: unknown, onError?: () => void) {
      rgbeLoads.push({ url, onLoad, onError: onError ?? (() => {}) });
    }
  }

  class FakeGLTFLoader {
    load(url: string, onLoad: (g: unknown) => void, _p?: unknown, onError?: () => void) {
      gltfLoads.push({ url, onLoad, onError: onError ?? (() => {}) });
    }
  }

  return {
    multiplyLog,
    translationArgs,
    scaleArgs,
    renderCalls,
    addedToScene,
    rgbeLoads,
    gltfLoads,
    fromLngLatCalls,
    FakeMatrix4,
    FakeRenderer,
    FakeScene,
    FakeCamera,
    FakeAmbientLight,
    FakeDirectionalLight,
    FakeRGBELoader,
    FakeGLTFLoader,
    bumpResetState: () => resetStateCalls++,
    getResetStateCalls: () => resetStateCalls,
    getRepaintCalls: () => repaintCalls,
    bumpRepaint: () => repaintCalls++,
    reset: () => {
      multiplyLog.length = 0;
      translationArgs.length = 0;
      scaleArgs.length = 0;
      renderCalls.length = 0;
      addedToScene.length = 0;
      rgbeLoads.length = 0;
      gltfLoads.length = 0;
      fromLngLatCalls.length = 0;
      resetStateCalls = 0;
      repaintCalls = 0;
    },
  };
});

vi.mock('maplibre-gl', () => {
  const MercatorCoordinate = {
    fromLngLat: (lngLat: { lng: number; lat: number }, altitude = 0) => {
      mocks.fromLngLatCalls.push({ lngLat, altitude });
      return {
        x: 0.25,
        y: 0.35,
        z: 0.001,
        meterInMercatorCoordinateUnits: () => 2.5,
      };
    },
  };
  return {
    MercatorCoordinate,
    // Kept for default-import consumers; the SUT uses a namespace import.
    default: { MercatorCoordinate },
  };
});

vi.mock('three', () => ({
  WebGLRenderer: mocks.FakeRenderer,
  Scene: mocks.FakeScene,
  Camera: mocks.FakeCamera,
  Matrix4: mocks.FakeMatrix4,
  AmbientLight: mocks.FakeAmbientLight,
  DirectionalLight: mocks.FakeDirectionalLight,
  SRGBColorSpace: 'srgb-mock',
  ACESFilmicToneMapping: 'aces-mock',
  PCFSoftShadowMap: 'pcfsoft-mock',
  EquirectangularReflectionMapping: 'equirect-mock',
}));

vi.mock('three/examples/jsm/loaders/RGBELoader.js', () => ({
  RGBELoader: mocks.FakeRGBELoader,
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: mocks.FakeGLTFLoader,
}));

import { MapLibreThreeLayer } from './maplibre-three-layer';

const IDENTITY_4X4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function renderOptions(matrix: number[]): CustomRenderMethodInput {
  return { modelViewProjectionMatrix: matrix } as unknown as CustomRenderMethodInput;
}

function makeMap(): MaplibreMap {
  return {
    getCanvas: () => ({}) as HTMLCanvasElement,
    triggerRepaint: () => mocks.bumpRepaint(),
  } as unknown as MaplibreMap;
}

beforeEach(() => {
  mocks.reset();
});

describe('MapLibreThreeLayer', () => {
  it('exposes the MapLibre custom-layer contract', () => {
    const layer = new MapLibreThreeLayer({ id: 'berm-3d', origin: [-88.005, 37.846] });
    expect(layer.id).toBe('berm-3d');
    expect(layer.type).toBe('custom');
    expect(layer.renderingMode).toBe('3d');
  });

  it('converts the origin to Mercator coordinates with altitude', () => {
    new MapLibreThreeLayer({ id: 'x', origin: [-88.005, 37.846], altitudeMeters: 115 });
    expect(mocks.fromLngLatCalls).toHaveLength(1);
    expect(mocks.fromLngLatCalls[0].lngLat).toEqual({ lng: -88.005, lat: 37.846 });
    expect(mocks.fromLngLatCalls[0].altitude).toBe(115);
  });

  it('translates the scene to the Mercator origin and scales meters correctly', () => {
    const layer = new MapLibreThreeLayer({ id: 'x', origin: [-88.005, 37.846] });
    layer.onAdd(makeMap(), {} as WebGL2RenderingContext);
    layer.render({} as WebGL2RenderingContext, renderOptions(IDENTITY_4X4));

    expect(mocks.translationArgs).toEqual([[0.25, 0.35, 0.001]]);
    // meterInMercatorCoordinateUnits() === 2.5; Y is negated per the reference
    expect(mocks.scaleArgs).toEqual([[2.5, -2.5, 2.5]]);
  });

  it('composes the camera matrix as camera * translation * scale * rotationX', () => {
    const layer = new MapLibreThreeLayer({ id: 'x', origin: [-88.005, 37.846] });
    layer.onAdd(makeMap(), {} as WebGL2RenderingContext);
    layer.render({} as WebGL2RenderingContext, renderOptions(IDENTITY_4X4));

    expect(mocks.multiplyLog).toEqual([
      'cameraMatrix*translation',
      '(cameraMatrix*translation)*scale',
      '((cameraMatrix*translation)*scale)*rotationX',
    ]);
  });

  it('configures a photorealistic renderer: sRGB, ACES, shadows, no autoclear', () => {
    const layer = new MapLibreThreeLayer({ id: 'x', origin: [0, 0], exposure: 1.2 });
    layer.onAdd(makeMap(), {} as WebGL2RenderingContext);
    const renderer = (layer as unknown as { renderer: InstanceType<typeof mocks.FakeRenderer> }).renderer;
    expect(renderer.autoClear).toBe(false);
    expect(renderer.outputColorSpace).toBe('srgb-mock');
    expect(renderer.toneMapping).toBe('aces-mock');
    expect(renderer.toneMappingExposure).toBe(1.2);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe('pcfsoft-mock');
  });

  it('renders an empty scene without errors when no content is given', () => {
    const layer = new MapLibreThreeLayer({ id: 'x', origin: [0, 0], content: [] });
    const map = makeMap();
    expect(() => {
      layer.onAdd(map, {} as WebGL2RenderingContext);
      layer.render({} as WebGL2RenderingContext, renderOptions(IDENTITY_4X4));
    }).not.toThrow();
    expect(mocks.renderCalls).toHaveLength(1);
    expect(mocks.getResetStateCalls()).toBe(1);
    expect(mocks.getRepaintCalls()).toBe(1);
  });

  it('does nothing harmful when render is called before onAdd', () => {
    const layer = new MapLibreThreeLayer({ id: 'x', origin: [0, 0] });
    expect(() => layer.render({} as WebGL2RenderingContext, renderOptions(IDENTITY_4X4))).not.toThrow();
    expect(mocks.renderCalls).toHaveLength(0);
  });

  it('runs content builders and survives a throwing builder', () => {
    const built: unknown[] = [];
    const layer = new MapLibreThreeLayer({
      id: 'x',
      origin: [0, 0],
      content: [
        (scene) => {
          built.push(scene);
        },
        () => {
          throw new Error('boom');
        },
      ],
    });
    expect(() => layer.onAdd(makeMap(), {} as WebGL2RenderingContext)).not.toThrow();
    expect(built).toHaveLength(1);
  });

  it('skips non-http(s) HDR and model URLs without calling the loaders', () => {
    const layer = new MapLibreThreeLayer({
      id: 'x',
      origin: [0, 0],
      hdrUrl: 'not-a-url',
      modelUrls: ['ftp://files.example/y.glb', '::bad::', ''],
    });
    expect(() => layer.onAdd(makeMap(), {} as WebGL2RenderingContext)).not.toThrow();
    expect(mocks.rgbeLoads).toHaveLength(0);
    expect(mocks.gltfLoads).toHaveLength(0);
  });

  it('loads valid HDR and GLTF urls and stays fail-closed when they error', () => {
    const layer = new MapLibreThreeLayer({
      id: 'x',
      origin: [0, 0],
      hdrUrl: 'https://example.com/env.hdr',
      modelUrls: ['https://example.com/berm.glb'],
    });
    layer.onAdd(makeMap(), {} as WebGL2RenderingContext);
    expect(mocks.rgbeLoads.map((l) => l.url)).toEqual(['https://example.com/env.hdr']);
    expect(mocks.gltfLoads.map((l) => l.url)).toEqual(['https://example.com/berm.glb']);

    // Loader failures must not throw into the map render loop.
    expect(() => {
      mocks.rgbeLoads[0].onError();
      mocks.gltfLoads[0].onError();
    }).not.toThrow();
  });

  it('applies the HDR environment map and shadow flags on successful loads', () => {
    const layer = new MapLibreThreeLayer({
      id: 'x',
      origin: [0, 0],
      hdrUrl: 'https://example.com/env.hdr',
      modelUrls: ['https://example.com/berm.glb'],
    });
    layer.onAdd(makeMap(), {} as WebGL2RenderingContext);

    const texture = { mapping: null as unknown };
    mocks.rgbeLoads[0].onLoad(texture);
    expect(texture.mapping).toBe('equirect-mock');

    const mesh = { isMesh: true, castShadow: false, receiveShadow: false };
    const gltfScene = { traverse: (cb: (o: unknown) => void) => cb(mesh) };
    mocks.gltfLoads[0].onLoad({ scene: gltfScene });
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mocks.addedToScene).toContain(gltfScene);
  });

  it('disposes cleanly on remove', () => {
    const layer = new MapLibreThreeLayer({ id: 'x', origin: [0, 0] });
    const map = makeMap();
    layer.onAdd(map, {} as WebGL2RenderingContext);
    expect(() => layer.onRemove(map, {} as WebGL2RenderingContext)).not.toThrow();
    const renderer = (layer as unknown as { renderer: unknown }).renderer;
    expect(renderer).toBeNull();
  });
});
