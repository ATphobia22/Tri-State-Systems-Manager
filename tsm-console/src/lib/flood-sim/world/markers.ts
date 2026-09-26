/**
 * world/markers.ts — gauge-station and anchor-site markers for the open world.
 *
 * Station positions come from `artifacts/tsm-river-valley-realtime-stations-v1.json`
 * (`verified_observation_stations`). Only stations that carry latitude/longitude
 * in the manifest are rendered; stations without coordinates are returned in
 * `unplaced` and listed in the UI legend — never fabricated or guessed.
 *
 * Positions are converted to a local ENU frame (feet, equirectangular
 * approximation about the anchor site). This is visualization-only placement,
 * not survey: the module documents the approximation and the datum caveat
 * (vertical_datum: SOURCE_GAGE_DATUM per the manifest).
 */

import * as THREE from 'three';
import stationsArtifact from '../../../../../artifacts/tsm-river-valley-realtime-stations-v1.json';
import { BONEBANK_GEOCODED_LAT, BONEBANK_GEOCODED_LNG } from '../../scientific-analytics';

/** Evidence-lock centroid for 13101 Bonebank Road (FEMA case 26-05-2022A packet). */
export const ANCHOR_SITE = {
  lat: 37.845887,
  lng: -88.005075,
  label: '13101 Bonebank Rd — anchor site (FEMA case 26-05-2022A)',
} as const;

interface StationRecord {
  station_id?: string;
  provider?: string;
  name?: string;
  river?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
}

export interface PlacedStation {
  stationId: string;
  name: string;
  river: string;
  provider: string;
  status: string;
  /** Local ENU feet relative to the anchor site: +x east, +z south. */
  xFt: number;
  zFt: number;
}

export interface UnplacedStation {
  stationId: string;
  name: string;
  reason: string;
}

function readStations(): StationRecord[] {
  const rec = stationsArtifact as { verified_observation_stations?: StationRecord[] };
  return rec.verified_observation_stations ?? [];
}

/** All 12 manifest stations with coordinates (equirectangular feet about the anchor). */
export function resolveStationMarkers(): { placed: PlacedStation[]; unplaced: UnplacedStation[] } {
  const placed: PlacedStation[] = [];
  const unplaced: UnplacedStation[] = [];
  const lat0 = (ANCHOR_SITE.lat * Math.PI) / 180;
  const ftPerDegLat = 364000; // ~111.2 km, visualization-only
  const ftPerDegLng = 364000 * Math.cos(lat0);

  for (const s of readStations()) {
    const id = s.station_id ?? 'unknown';
    const name = s.name ?? id;
    if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') {
      unplaced.push({
        stationId: id,
        name,
        reason: 'no latitude/longitude in the stations manifest — position not rendered (never guessed)',
      });
      continue;
    }
    placed.push({
      stationId: id,
      name,
      river: s.river ?? '',
      provider: s.provider ?? '',
      status: s.status ?? '',
      xFt: (s.longitude - ANCHOR_SITE.lng) * ftPerDegLng,
      zFt: -(s.latitude - ANCHOR_SITE.lat) * ftPerDegLat,
    });
  }
  return { placed, unplaced };
}

export interface BuiltMarkers {
  group: THREE.Group;
  placed: PlacedStation[];
  unplaced: UnplacedStation[];
  dispose(): void;
}

function makePin(color: number, label: string): THREE.Group {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 46, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  stem.position.y = 23;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(7, 18, 14),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.35 }),
  );
  head.position.y = 52;
  group.add(stem, head);
  group.name = label;
  return group;
}

/**
 * Build markers. `groundHeightAt(xFt, zFt)` samples the terrain so pins sit
 * on the surface. Markers outside the modeled domain are clamped into view
 * and flagged — the domain is a local window, not the whole river valley.
 */
export function buildMarkers(opts: {
  domainHalfWidthFt: number;
  domainHalfDepthFt: number;
  groundHeightAt: (xFt: number, zFt: number) => number;
}): BuiltMarkers {
  const { placed, unplaced } = resolveStationMarkers();
  const group = new THREE.Group();
  group.name = 'flood-sim-markers';

  const hw = opts.domainHalfWidthFt;
  const hd = opts.domainHalfDepthFt;

  for (const st of placed) {
    const cx = Math.min(hw * 0.96, Math.max(-hw * 0.96, st.xFt));
    const cz = Math.min(hd * 0.96, Math.max(-hd * 0.96, st.zFt));
    const pin = makePin(0x2f7fd1, `gauge ${st.stationId} — ${st.name}`);
    pin.position.set(cx, opts.groundHeightAt(cx, cz), cz);
    pin.userData = { kind: 'gauge', ...st };
    group.add(pin);
  }

  // Anchor site: distinct gold pin at the domain centre (local origin).
  const anchor = makePin(0xd8a920, ANCHOR_SITE.label);
  anchor.position.set(0, opts.groundHeightAt(0, 0), 0);
  anchor.scale.setScalar(1.35);
  anchor.userData = {
    kind: 'anchor',
    lat: ANCHOR_SITE.lat,
    lng: ANCHOR_SITE.lng,
    geocodedLat: BONEBANK_GEOCODED_LAT,
    geocodedLng: BONEBANK_GEOCODED_LNG,
  };
  group.add(anchor);

  return {
    group,
    placed,
    unplaced,
    dispose(): void {
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    },
  };
}
