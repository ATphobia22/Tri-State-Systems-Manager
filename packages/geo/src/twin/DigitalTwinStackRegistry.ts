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
    notes: "3D Tiles / globe; expand self-hosted tiles path",
  },
  {
    id: "three-r3f",
    name: "Three.js / R3F",
    layer: "RENDER",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    inTreePath: "tsm-console/src/routes/TwinCanvasView.tsx",
    notes: "In-tree TwinCanvas / WebGPU terrain experiments",
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
    status: "REFERENCE_ONLY",
    authority: "MODEL_SIMULATION",
    repo: "https://github.com/GenericMappingTools/pygmt",
    notes: "Raster DEM / bathymetry preprocessing",
  },
  {
    id: "3dfier",
    name: "3dfier",
    layer: "MESH",
    status: "REFERENCE_ONLY",
    authority: "PRESENTATION",
    repo: "https://github.com/tudelft3d/3dfier",
    notes: "2D GIS → 3D city/terrain solids",
  },
  {
    id: "hydropol2d",
    name: "HydroPol2D",
    layer: "MESH",
    status: "REFERENCE_ONLY",
    authority: "MODEL_SIMULATION",
    repo: "https://github.com/marcusnobrega-eng/HydroPol2D",
    notes: "2D hydro mesh / inundation engine",
  },
  {
    id: "eclipse-ditto",
    name: "Eclipse Ditto",
    layer: "TELEMETRY",
    status: "ADAPTER_READY",
    authority: "PRESENTATION",
    repo: "https://github.com/eclipse-ditto/ditto",
    notes: "Digital twin state & WebSocket events — operator deploy",
  },
  {
    id: "dtdl",
    name: "DTDL (Open Digital Twins)",
    layer: "SCHEMA",
    status: "REFERENCE_ONLY",
    authority: "PRESENTATION",
    repo: "https://github.com/Azure/opendigitaltwins-dtdl",
    notes: "Twin graph schema language",
  },
  {
    id: "aoi-coverage-panel",
    name: "AoiCoveragePanel",
    layer: "RENDER",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    inTreePath: "tsm-console/src/components/AoiCoveragePanel.tsx",
    notes: "DERIVED / non-FIRM coverage UI on Map/Twin",
  },
]);

export function listDigitalTwinStack(): readonly TwinStackEntry[] {
  return DIGITAL_TWIN_STACK;
}

export function getTwinComponent(id: string): TwinStackEntry | undefined {
  return DIGITAL_TWIN_STACK.find((e) => e.id === id);
}
