/**
 * ADR-006 Agentic Autonomy Ladder — runtime policy.
 * S1 is production default. S2 requires explicit human gate.
 * OpenManus-style agents must not bypass this module.
 */

export type AutonomyScope = "S1" | "S2" | "S3";

export type AgentToolId =
  | "hydrologic.read_snapshot"
  | "analytics.freeboard_residual"
  | "spatial.h3_summary"
  | "draft.local_llm_text"
  | "evidence.propose_artifact";

/** S2 allow-list only (ADR-006). */
export const S2_TOOL_ALLOWLIST: readonly AgentToolId[] = [
  "hydrologic.read_snapshot",
  "analytics.freeboard_residual",
  "spatial.h3_summary",
  "draft.local_llm_text",
  "evidence.propose_artifact",
] as const;

const FORBIDDEN_WITHOUT_NEW_ADR = [
  "evidence.ledger_append_without_human",
  "fema.auto_file_loma",
  "fema.auto_file_lomr",
  "grants.auto_submit",
  "external.paid_model_api",
] as const;

export interface AgentRuntimeConfig {
  scope: AutonomyScope;
  humanGatePresent: boolean;
  localLlmOnly: boolean;
}

export const DEFAULT_AGENT_RUNTIME: AgentRuntimeConfig = {
  scope: "S1",
  humanGatePresent: true,
  localLlmOnly: true,
};

export function isToolAllowed(tool: AgentToolId, cfg: AgentRuntimeConfig = DEFAULT_AGENT_RUNTIME): boolean {
  if (cfg.scope === "S1") return false;
  if (cfg.scope === "S3") return false; // future only
  if (cfg.scope === "S2") {
    if (!cfg.humanGatePresent) return false;
    return (S2_TOOL_ALLOWLIST as readonly string[]).includes(tool);
  }
  return false;
}

export function assertNotForbiddenAction(actionId: string): void {
  if ((FORBIDDEN_WITHOUT_NEW_ADR as readonly string[]).includes(actionId)) {
    throw new Error(
      `ADR-006 forbidden action: ${actionId}. Requires new ADR + human authority; auto-filing is never enabled.`,
    );
  }
}

export function canProposeEvidence(cfg: AgentRuntimeConfig = DEFAULT_AGENT_RUNTIME): boolean {
  return cfg.scope === "S2" && cfg.humanGatePresent && isToolAllowed("evidence.propose_artifact", cfg);
}

export function canAppendEvidenceLedger(_cfg: AgentRuntimeConfig = DEFAULT_AGENT_RUNTIME): boolean {
  // Ledger write always requires a separate human role — never the agent alone.
  return false;
}
