/**
 * OpenManus-pattern agent bridge (S1/S2 only).
 * Does not embed the full OpenManus monorepo.
 * Wires tool proposals through ADR-006 gates.
 */

import {
  assertNotForbiddenAction,
  canProposeEvidence,
  DEFAULT_AGENT_RUNTIME,
  isToolAllowed,
  type AgentRuntimeConfig,
  type AgentToolId,
} from "./autonomy";

export interface AgentProposal {
  tool: AgentToolId;
  summary: string;
  payload: Record<string, unknown>;
  requiresHumanApproval: true;
  authorityClass: "OBSERVATION" | "PLANNING" | "CONTEXT" | "DRAFT";
  isSimulationDemo: boolean;
}

export interface AgentBridgeResult {
  ok: boolean;
  proposal?: AgentProposal;
  error?: string;
  scope: AgentRuntimeConfig["scope"];
}

export class OpenManusAgentBridge {
  constructor(private readonly cfg: AgentRuntimeConfig = DEFAULT_AGENT_RUNTIME) {}

  /** S1: no agent tools execute. */
  status(): { scope: string; toolsEnabled: boolean } {
    return {
      scope: this.cfg.scope,
      toolsEnabled: this.cfg.scope === "S2" && this.cfg.humanGatePresent,
    };
  }

  propose(tool: AgentToolId, summary: string, payload: Record<string, unknown>): AgentBridgeResult {
    assertNotForbiddenAction("fema.auto_file_loma");
    assertNotForbiddenAction("evidence.ledger_append_without_human");

    if (!isToolAllowed(tool, this.cfg)) {
      return {
        ok: false,
        scope: this.cfg.scope,
        error: `Tool ${tool} blocked at scope ${this.cfg.scope} (ADR-006).`,
      };
    }

    if (tool === "evidence.propose_artifact" && !canProposeEvidence(this.cfg)) {
      return {
        ok: false,
        scope: this.cfg.scope,
        error: "Evidence proposal requires S2 + human gate.",
      };
    }

    return {
      ok: true,
      scope: this.cfg.scope,
      proposal: {
        tool,
        summary,
        payload,
        requiresHumanApproval: true,
        authorityClass: tool.startsWith("hydrologic") ? "OBSERVATION" : "DRAFT",
        isSimulationDemo: false,
      },
    };
  }

  /** Explicitly refuse regulatory filing. */
  refuseAutoFile(kind: "LOMA" | "LOMR" | "GRANT"): AgentBridgeResult {
    return {
      ok: false,
      scope: this.cfg.scope,
      error: `Auto-file ${kind} is forbidden (ADR-006 / ADR-004). Human authority remains final.`,
    };
  }
}

export const defaultOpenManusBridge = new OpenManusAgentBridge(DEFAULT_AGENT_RUNTIME);
