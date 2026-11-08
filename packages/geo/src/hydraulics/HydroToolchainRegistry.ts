/**
 * Hydro / HEC-RAS / digital-twin toolchain registry (TypeScript side).
 * Optional adapters: when operator installs Python tools, bridges report installed:true.
 * Regulatory LOMA still requires human PE/survey — not automated here.
 */

export type ToolIntegrationStatus =
  | "INTEGRATED"
  | "ADAPTER_READY"
  | "EXTERNAL_OPERATOR"
  | "REFERENCE_ONLY";

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
    notes: "Python bridge integrations/hydro/python/ras_commander_bridge.py; pip install ras-commander",
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
    notes: "Geometry .g0x parse without RAS exe",
  },
  {
    id: "ras2fim",
    name: "NOAA ras2fim",
    repo: "https://github.com/NOAA-OWP/ras2fim",
    status: "EXTERNAL_OPERATOR",
    authority: "MODEL_SIMULATION",
    notes: "Inundation libraries from HEC-RAS; Windows operator workflow",
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
    notes: "Multi-engine 2D hydraulics Python toolkit",
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
    notes: "Model coupling standards; see OPENMI notes in repo",
  },
  {
    id: "hec-ras-boundary",
    name: "HecRasIntegrationBoundary",
    status: "INTEGRATED",
    authority: "MODEL_SIMULATION",
    notes: "packages/geo/src/hydraulics/HecRasIntegrationBoundary.ts",
  },
]);

export function listHydroToolchain(): readonly HydroToolEntry[] {
  return HYDRO_TOOLCHAIN;
}

export function getHydroTool(id: string): HydroToolEntry | undefined {
  return HYDRO_TOOLCHAIN.find((t) => t.id === id);
}
