/**
 * Hydro / HEC-RAS / water-resources / digital-twin toolchain registry (TypeScript).
 * Optional Python bridges under integrations/hydro/python/.
 */

export type ToolIntegrationStatus =
  | "INTEGRATED"
  | "ADAPTER_READY"
  | "EXTERNAL_OPERATOR"
  | "REFERENCE_ONLY"
  | "PARTIAL";

export type HydroToolEntry = {
  id: string;
  name: string;
  repo?: string;
  status: ToolIntegrationStatus;
  authority: "MODEL_SIMULATION" | "PRESENTATION" | "REGULATORY_REFERENCE";
  notes: string;
};

export const HYDRO_TOOLCHAIN: readonly HydroToolEntry[] = Object.freeze([
  {
    id: "ras-commander",
    name: "ras-commander",
    repo: "https://github.com/gpt-cmdr/ras-commander",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "integrations/hydro/python/ras_commander_bridge.py",
  },
  {
    id: "rascontrol",
    name: "rascontrol",
    repo: "https://github.com/mikebannis/rascontrol",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "Windows COM; rascontrol_bridge.py",
  },
  {
    id: "parserasgeo",
    name: "parserasgeo",
    repo: "https://github.com/mikebannis/parserasgeo",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "Geometry .g0x parse",
  },
  {
    id: "ras2fim",
    name: "NOAA ras2fim",
    repo: "https://github.com/NOAA-OWP/ras2fim",
    status: "EXTERNAL_OPERATOR",
    authority: "MODEL_SIMULATION",
    notes: "Inundation libraries from HEC-RAS",
  },
  {
    id: "hecrasio",
    name: "hecrasio",
    repo: "https://github.com/Dewberry/hecrasio",
    status: "REFERENCE_ONLY",
    authority: "MODEL_SIMULATION",
    notes: "PFRA batch output tooling",
  },
  {
    id: "pyhmt2d",
    name: "pyHMT2D",
    repo: "https://github.com/psu-efd/pyHMT2D",
    status: "REFERENCE_ONLY",
    authority: "MODEL_SIMULATION",
    notes: "Multi-engine 2D hydraulics",
  },
  {
    id: "epa-swmm",
    name: "EPA SWMM / pyswmm",
    repo: "https://github.com/OpenWaterAnalytics/pyswmm",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "integrations/hydro/python/swmm_bridge.py — urban drainage",
  },
  {
    id: "landlab",
    name: "Landlab",
    repo: "https://github.com/landlab/landlab",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "integrations/hydro/python/landlab_bridge.py",
  },
  {
    id: "flopy",
    name: "FloPy / MODFLOW",
    repo: "https://github.com/modflowpy/flopy",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "integrations/hydro/python/flopy_bridge.py — groundwater",
  },
  {
    id: "pygeoapi",
    name: "pygeoapi",
    repo: "https://github.com/geopython/pygeoapi",
    status: "REFERENCE_ONLY",
    authority: "PRESENTATION",
    notes: "OGC API Features/Coverages/Processes",
  },
  {
    id: "maplibre",
    name: "MapLibre GL JS",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    notes: "In-tree digital twin maps",
  },
  {
    id: "cesium",
    name: "CesiumJS",
    status: "PARTIAL",
    authority: "PRESENTATION",
    notes: "3D Tiles / globe path",
  },
  {
    id: "openmi-bmi",
    name: "OpenMI / BMI",
    status: "REFERENCE_ONLY",
    authority: "MODEL_SIMULATION",
    notes: "Model coupling standards",
  },
  {
    id: "hec-ras-boundary",
    name: "HecRasIntegrationBoundary",
    status: "INTEGRATED",
    authority: "MODEL_SIMULATION",
    notes: "packages/geo/src/hydraulics/HecRasIntegrationBoundary.ts",
  },
  {
    id: "digital-twin-stack",
    name: "DigitalTwinStackRegistry",
    status: "INTEGRATED",
    authority: "PRESENTATION",
    notes: "packages/geo/src/twin/DigitalTwinStackRegistry.ts",
  },
]);

export function listHydroToolchain(): readonly HydroToolEntry[] {
  return HYDRO_TOOLCHAIN;
}

export function getHydroTool(id: string): HydroToolEntry | undefined {
  return HYDRO_TOOLCHAIN.find((t) => t.id === id);
}
