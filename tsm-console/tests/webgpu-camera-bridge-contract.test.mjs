import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bridgeMapLibreCameraToWebGpu,
  lngLatToLocalMeters,
} from '../src/gpu/webgpu-camera-bridge.ts';

const ORIGIN = {
  lonDeg: -88.005075,
  latDeg: 37.845887,
  verticalDatum: 'NAVD88',
  horizontalCrs: 'local-ENU-approx',
};

test('lngLatToLocalMeters is zero at the recorded origin', () => {
  const [e, n] = lngLatToLocalMeters(ORIGIN.lonDeg, ORIGIN.latDeg, ORIGIN);
  assert.equal(e, 0);
  assert.equal(n, 0);
});

test('bridge emits 16-float inverse VP and records provenance', () => {
  const bridged = bridgeMapLibreCameraToWebGpu(
    {
      centerLngLat: [ORIGIN.lonDeg, ORIGIN.latDeg],
      altitudeMeters: 500,
      bearingDeg: 0,
      pitchDeg: 45,
      fovDeg: 60,
      viewport: [1280, 720],
      nearMeters: 1,
      farMeters: 50000,
    },
    ORIGIN,
  );
  assert.equal(bridged.inverseViewProjection.length, 16);
  assert.ok(bridged.inverseViewProjection.every((v) => Number.isFinite(v)));
  assert.equal(bridged.transformProvenance.units, 'metres');
  assert.equal(bridged.transformProvenance.verticalDatum, 'NAVD88');
  assert.match(bridged.transformProvenance.note, /not silent Web Mercator/i);
});

test('bridge refuses non-finite altitude (no silent defaults)', () => {
  assert.throws(() =>
    bridgeMapLibreCameraToWebGpu(
      {
        centerLngLat: [ORIGIN.lonDeg, ORIGIN.latDeg],
        altitudeMeters: Number.NaN,
        bearingDeg: 0,
        pitchDeg: 0,
        fovDeg: 60,
        viewport: [800, 600],
        nearMeters: 1,
        farMeters: 10000,
      },
      ORIGIN,
    ),
  );
});

test('bridge refuses invalid near/far', () => {
  assert.throws(() =>
    bridgeMapLibreCameraToWebGpu(
      {
        centerLngLat: [ORIGIN.lonDeg, ORIGIN.latDeg],
        altitudeMeters: 100,
        bearingDeg: 0,
        pitchDeg: 0,
        fovDeg: 60,
        viewport: [800, 600],
        nearMeters: 10,
        farMeters: 5,
      },
      ORIGIN,
    ),
  );
});
