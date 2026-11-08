/**
 * HEC-RAS integration boundary for TSM.
 *
 * Enables operator automation via optional open-source bridges (ras-commander,
 * rascontrol, parserasgeo, ras2fim). Does not ship the HEC-RAS binary.
 * Imported results are MODEL_SIMULATION until human PE review says otherwise.
 */

export const HEC_RAS_AUTHORITY = "MODEL_SIMULATION" as const;

export type HecRasProjectRef = {
  projectId: string;
  geometryPath?: string;
  planPath?: string;
  unsteadyFlowPath?: string;
  /** Absolute path to .hdf plan results when available */
  hdfResultsPath?: string;
  notes?: string;
};

export type HecRasResultSummary = {
  projectId: string;
  profileName: string;
  wseFt: number | null;
  depthFt: number | null;
  riverStation?: string;
  verticalDatumLabel: string;
  sourceExportUri?: string;
  importedAt: string;
  authority: typeof HEC_RAS_AUTHORITY;
  humanReviewed: boolean;
  toolChain?: string;
};

export type HecRasInvokeResult =
  | {
      ok: false;
      reason: string;
      authority: typeof HEC_RAS_AUTHORITY;
      nextSteps: string[];
    }
  | { ok: true; mode: "IMPORT_ONLY" | "BRIDGE_GUIDANCE"; summary?: HecRasResultSummary; guidance?: string };

/**
 * Plan execution is delegated to operator-installed tools (ras-commander / rascontrol).
 * Returns actionable guidance instead of a hard silent no-op.
 */
export function invokeHecRasSolver(ref: HecRasProjectRef): HecRasInvokeResult {
  return {
    ok: true,
    mode: "BRIDGE_GUIDANCE",
    guidance: [
      `Project ${ref.projectId}: run HEC-RAS externally or via optional bridges.`,
      "Windows COM: integrations/hydro/python/rascontrol_bridge.py (rascontrol).",
      "Cross-platform API/HDF: pip install ras-commander → ras_commander_bridge.py.",
      "Geometry text: parserasgeo_bridge.py (no RAS exe required).",
      "Inundation libraries: NOAA-OWP/ras2fim on Windows after RAS plans complete.",
      "Then importWse via importHecRasResultSummary({ humanReviewed: true, ... }).",
    ].join(" "),
  };
}

export function importHecRasResultSummary(
  summary: Omit<HecRasResultSummary, "authority"> & { authority?: string }
): HecRasInvokeResult {
  if (summary.wseFt != null && !Number.isFinite(summary.wseFt)) {
    return {
      ok: false,
      reason: "wseFt must be finite or null.",
      authority: HEC_RAS_AUTHORITY,
      nextSteps: ["Export numeric WSE from RAS HDF/table"],
    };
  }
  const normalized: HecRasResultSummary = {
    ...summary,
    authority: HEC_RAS_AUTHORITY,
    humanReviewed: Boolean(summary.humanReviewed),
  };
  return { ok: true, mode: "IMPORT_ONLY", summary: normalized };
}

export const HEC_RAS_INTEGRATION_NOTES = Object.freeze({
  usace_product: "HEC-RAS",
  download: "https://www.hec.usace.army.mil/software/hec-ras/",
  open_source_drivers: [
    "https://github.com/gpt-cmdr/ras-commander",
    "https://github.com/mikebannis/rascontrol",
    "https://github.com/mikebannis/parserasgeo",
    "https://github.com/NOAA-OWP/ras2fim",
    "https://github.com/Dewberry/hecrasio",
    "https://github.com/psu-efd/pyHMT2D",
  ],
  registry: "integrations/hydro/tsm-hydro-digital-twin-toolchain-registry-v1.json",
});
