/**
 * Digital twin rendering + telemetry stack registry for TSM.
 */

export type TwinComponentStatus = "INTEGRATED" | "PARTIAL" | "ADAPTER_READY" | "REFERENCE_ONLY";

export type TwinStackEntry = {
  id: string;
  name: string;
  layer: "RENDER" | "TERRAIN" | "MESH" | "TELEMETRY" | "SCHEMA";
  status: TwinComponentStatus;
  authority: "PRESENTATION" | "MODEL_SIMULATION";
  repo?: string;
  inTreePath?: string;
  notes: string;
};

export const DIGITAL_TWIN_STACK: readonly TwinStackEntry[] = Object.freeze([
  {
    id: "maplibre",
    name: "MapLibre GL JS",
    layer: "RENDER",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    repo: "https://github.com/maplibre/maplibre-gl-js",
    inTreePath: "tsm-console/src/components/RealWorldTwinMap.tsx",
    notes: "Primary 2D/terrain-rgb map engine",
  },
  {
    id: "cesium",
    name: "CesiumJS",
    layer: "RENDER",
    status: "PARTIAL",
    authority: "PRESENTATION",
    repo: "https://github.com/CesiumGS/cesium",
    inTreePath: "packages/geo/src/twin/CesiumIntegration.ts",
    notes: "buildBonebankCesiumConfig + tileset/Ion wiring",
  },
  {
    id: "three-r3f",
    name: "Three.js / R3F",
    layer: "RENDER",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    inTreePath: "tsm-console/src/routes/TwinCanvasView.tsx",
    notes: "TwinCanvas / WebGPU terrain experiments",
  },
  {
    id: "terrain-rgb-3dep",
    name: "USGS 3DEP Terrain-RGB",
    layer: "TERRAIN",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    notes: "Screening DEM tiles — DERIVED / non-FIRM",
  },
  {
    id: "pygmt",
    name: "PyGMT",
    layer: "MESH",
    status: "ADAPTER_READY",
    authority: "PRESENTATION",
    repo: "https://github.com/GenericMappingTools/pygmt",
    inTreePath: "integrations/twin/python/pygmt_bridge.py",
    notes: "DEM/bathymetry preprocessing",
  },
  {
    id: "3dfier",
    name: "3dfier",
    layer: "MESH",
    status: "ADAPTER_READY",
    authority: "PRESENTATION",
    repo: "https://github.com/tudelft3d/3dfier",
    inTreePath: "integrations/twin/python/threedfier_bridge.py",
    notes: "2D GIS → 3D solids",
  },
  {
    id: "hydropol2d",
    name: "HydroPol2D",
    layer: "MESH",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    repo: "https://github.com/marcusnobrega-eng/HydroPol2D",
    inTreePath: "integrations/twin/python/hydropol2d_bridge.py",
    notes: "2D hydro mesh / inundation engine",
  },
  {
    id: "eclipse-ditto",
    name: "Eclipse Ditto",
    layer: "TELEMETRY",
    status: "ADAPTER_READY",
    authority: "PRESENTATION",
    repo: "https://github.com/eclipse-ditto/ditto",
    inTreePath: "integrations/twin/ditto/ditto-adapter.mjs",
    notes: "HTTP/WS twin state; TSM_DITTO_BASE_URL",
  },
  {
    id: "dtdl",
    name: "DTDL (Open Digital Twins)",
    layer: "SCHEMA",
    status: "ADAPTER_READY",
    authority: "PRESENTATION",
    repo: "https://github.com/Azure/opendigitaltwins-dtdl",
    inTreePath: "integrations/twin/dtdl/bonebank-site.dtdl.json",
    notes: "Bonebank site interface model",
  },
  {
    id: "aoi-coverage-panel",
    name: "AoiCoveragePanel",
    layer: "RENDER",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    inTreePath: "tsm-console/src/components/AoiCoveragePanel.tsx",
    notes: "DERIVED / non-FIRM coverage UI",
  },
]);

export function listDigitalTwinStack(): readonly TwinStackEntry[] {
  return DIGITAL_TWIN_STACK;
}

export function getTwinComponent(id: string): TwinStackEntry | undefined {
  return DIGITAL_TWIN_STACK.find((e) => e.id === id);
}
