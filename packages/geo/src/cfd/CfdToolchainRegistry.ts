export type CfdToolStatus = "INTEGRATED" | "ADAPTER_READY" | "REFERENCE_ONLY";

export type CfdToolEntry = {
  id: string;
  name: string;
  status: CfdToolStatus;
  authority: "MODEL_SIMULATION";
  repo?: string;
  notes: string;
};

export const CFD_TOOLCHAIN: readonly CfdToolEntry[] = Object.freeze([
  {
    id: "sdf",
    name: "SDF geometry helpers",
    status: "INTEGRATED",
    authority: "MODEL_SIMULATION",
    notes: "packages/geo/src/cfd/SdfGeometry.ts",
  },
  {
    id: "fenicsx",
    name: "FEniCSx",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    repo: "https://github.com/FEniCS/dolfinx",
    notes: "integrations/cfd/python/fenicsx_bridge.py",
  },
  {
    id: "openfoam",
    name: "OpenFOAM",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    repo: "https://github.com/OpenFOAM/OpenFOAM-dev",
    notes: "integrations/cfd/python/openfoam_bridge.py",
  },
  {
    id: "simscale",
    name: "SimScale",
    status: "ADAPTER_READY",
    authority: "MODEL_SIMULATION",
    notes: "integrations/cfd/python/simscale_bridge.py — requires operator API token",
  },
]);

export function listCfdToolchain(): readonly CfdToolEntry[] {
  return CFD_TOOLCHAIN;
}
