/**
 * HEC-RAS integration boundary for TSM.
 *
 * USACE HEC-RAS is closed-source desktop software. TSM does NOT embed the HEC-RAS
 * solver. This module defines fail-closed contracts for:
 *  - registering plan/geometry/flow file paths produced outside TSM
 *  - importing published result summaries (depth, WSE tables) after human export
 *  - labeling all HEC-RAS-derived products as MODEL / SIMULATION evidence
 *
 * Full regulatory HEC-RAS studies remain operator-run in HEC-RAS with PE oversight.
 */

export const HEC_RAS_AUTHORITY = "MODEL_SIMULATION" as const;

export type HecRasProjectRef = {
  projectId: string;
  /** Paths on operator machine or object store — not executed by TSM. */
  geometryPath?: string;
  planPath?: string;
  unsteadyFlowPath?: string;
  notes?: string;
};

export type HecRasResultSummary = {
  projectId: string;
  profileName: string;
  /** Water surface elevation ft, vertical datum as labeled by the modeler. */
  wseFt: number | null;
  depthFt: number | null;
  riverStation?: string;
  verticalDatumLabel: string;
  sourceExportUri?: string;
  importedAt: string;
  authority: typeof HEC_RAS_AUTHORITY;
  humanReviewed: boolean;
};

export type HecRasInvokeResult =
  | { ok: false; reason: string; authority: typeof HEC_RAS_AUTHORITY }
  | { ok: true; mode: "IMPORT_ONLY"; summary: HecRasResultSummary };

/** Fail-closed: TSM never launches HEC-RAS binaries. */
export function invokeHecRasSolver(_ref: HecRasProjectRef): HecRasInvokeResult {
  return {
    ok: false,
    reason:
      "HEC-RAS solver is not embedded. Run HEC-RAS externally, export results, then importHecRasResultSummary.",
    authority: HEC_RAS_AUTHORITY,
  };
}

export function importHecRasResultSummary(
  summary: Omit<HecRasResultSummary, "authority"> & { authority?: string }
): HecRasInvokeResult {
  if (!summary.humanReviewed) {
    return {
      ok: false,
      reason: "humanReviewed must be true before HEC-RAS results enter the evidence path.",
      authority: HEC_RAS_AUTHORITY,
    };
  }
  if (summary.wseFt != null && !Number.isFinite(summary.wseFt)) {
    return { ok: false, reason: "wseFt must be finite or null.", authority: HEC_RAS_AUTHORITY };
  }
  const normalized: HecRasResultSummary = {
    ...summary,
    authority: HEC_RAS_AUTHORITY,
    humanReviewed: true,
  };
  return { ok: true, mode: "IMPORT_ONLY", summary: normalized };
}

export const HEC_RAS_INTEGRATION_NOTES = Object.freeze({
  usace_product: "HEC-RAS (Hydrologic Engineering Center — River Analysis System)",
  download: "https://www.hec.usace.army.mil/software/hec-ras/",
  tsm_role: "Import human-exported results; never claim in-process RAS solve",
  related_tsm: [
    "tsm-console/src/lib/flood-engineering-toolkit.ts",
    "tsm-console/src/lib/lag-bfe-freeboard.ts",
    "tsm-console/src/components/FloodSimulator.tsx",
  ],
});
