# TSM Living Twin World-Building Architecture
**Status:** Implementation package — 2026-11-22  
**Branch target:** `feat/world-building-living-twin-20261122`  
**Authority rule:** Human authority final. Presentation / HUD / particle / camera layers never mutate regulatory or hydro evidence. Fail closed on CRS/datum ambiguity.

## Scope
End-to-end delivery of the seven prioritized recommendations derived from FS25/FS19 mod research (SeasonalCropStress, SoilFertilizer, flow_visualizer SPH, AdvancedDamageSystem, camera systems, dashboards, AutoDrive/Courseplay patterns).

1. Hydro + Land Layer (Precision Land Management)
2. Fluid Surface Play (SPH / particle viz)
3. Camera + Cinematic System
4. Infrastructure Health (Condition/Stress)
5. Interactive HUD / Tablet
6. Route / Agent Layer
7. Creator UX

## Non-negotiable constraints
- No invented CRS, datum transforms, or vertical datums. Use existing TSM geodesy contracts only.
- All land/soil/moisture state is **DERIVED** or **SCENARIO**. Never labeled OBSERVED or REGULATORY.
- Evidence packages remain immutable; living-twin state is a separate, versioned, ephemeral scenario store.
- All new code is MIT/Apache-2.0 compatible and lives under `domains/living-twin/` + `packages/living-twin/`.

## Data model (core)

### ParcelLandState (per cadastral or synthetic parcel)
```typescript
interface ParcelLandState {
  parcelId: string;                    // stable TSM parcel key
  geometryHash: string;                // source geometry integrity
  moisture: number;                    // 0..1
  nutrients: { n: number; p: number; k: number; om: number; ph: number };
  compaction: number;                  // 0..1
  stress: { drought: number; weed: number; pest: number; disease: number };
  cropHistory: string[];               // last 3 crop codes
  soilTexture: "sandy" | "loam" | "clay" | "unknown";
  lastUpdated: string;                 // ISO-8601, simulation time
  provenance: ProvenanceRef;           // points to weather + method + commit
}
```

### InfrastructureAssetHealth
```typescript
interface InfrastructureAssetHealth {
  assetId: string;
  assetType: "pump" | "berm" | "gauge" | "culvert" | "road" | "levee";
  systems: Record<string, { condition: number; stress: number }>; // 0..1
  serviceIntervalHours: number;
  lastServiceAt: string | null;
  reliabilityClass: "premium" | "standard" | "legacy";
  provenance: ProvenanceRef;
}
```

### CameraPath
```typescript
interface CameraPath {
  id: string;
  name: string;
  nodes: Array<{
    position: [number, number, number]; // ECEF or local scene CRS only
    orientation: [number, number, number, number]; // quaternion
    fov: number;
    durationMs: number;
    label?: string;
  }>;
  boundEvidenceIds: string[];          // never mutates them
}
```

## Package layout
```
domains/living-twin/
  land-management/     # moisture, nutrients, stress engines
  hydro-viz/           # SPH adapter + Three/Cesium surface
  camera/              # path player + multi-POV
  infra-health/        # Condition/Stress model
  hud/                 # React tablet + overlays
  routes-agents/       # path networks + simple stakeholder agents
packages/living-twin/  # shared TS contracts + pure functions
docs/world-building/   # this file + ADRs
schemas/living-twin/   # JSON Schema for all state objects
```

## Integration points
- Weather driver: existing NOAA/USGS adapters only.
- Geometry: existing parcel and building identity services.
- Visualization: MapLibre / Cesium / Three.js surfaces already present in `tsm-console`.
- Unreal path: camera paths exportable as Level Sequence descriptors (future).
- CI: new workflow `living-twin-contract.yml` that validates schemas, pure functions, and non-mutation of evidence.

## Acceptance criteria (end-to-end)
- [ ] Schema validation passes for all state objects.
- [ ] Land-management pure functions are deterministic given fixed weather + crop inputs.
- [ ] HUD components render without network and never write to evidence store.
- [ ] Camera path player is pure and side-effect free except for scene camera control.
- [ ] Infrastructure health stress only increases from explicit operating-condition events.
- [ ] All new modules declare `presentationOnly: true` in their package metadata.
- [ ] Google Drive design package and GitHub branch contain identical architecture document.

## Sequencing
1. Schemas + pure TypeScript models (this package).
2. Land-management engine (moisture + nutrients).
3. HUD + tablet React components.
4. Camera path system.
5. Infrastructure health.
6. SPH surface adapter (research path first).
7. Routes + agents (lowest priority for regulatory safety).
