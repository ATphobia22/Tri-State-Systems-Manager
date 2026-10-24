/**
 * @tsm/agent-runtime
 * ADR-006: Agentic Autonomy Ladder — S1 default, S2 human-gated, S3 future.
 * Agents inform; they never silently govern. Human authority remains final.
 */

export type AutonomyLevel = "S1_ADVISE" | "S2_HUMAN_GATED" | "S3_BOUNDED_ACT";

export type ToolScope =
  | "read_public_data"
  | "read_evidence"
  | "draft_report"
  | "queue_job"
  | "request_approval"
  | "notify";

export interface AgentContext {
  readonly sessionId: string;
  readonly operatorId?: string;
  readonly autonomy: AutonomyLevel;
  readonly allowedTools: ReadonlySet<ToolScope>;
  readonly jurisdiction?: string;
}

export interface AgentAction {
  readonly id: string;
  readonly tool: ToolScope;
  readonly intent: string;
  readonly payload: Record<string, unknown>;
  readonly requiresApproval: boolean;
}

export interface AgentResult {
  readonly actionId: string;
  readonly status: "advised" | "queued_for_approval" | "rejected" | "executed";
  readonly message: string;
  readonly evidenceRef?: string;
}

const S1_TOOLS: ReadonlySet<ToolScope> = new Set([
  "read_public_data",
  "read_evidence",
  "draft_report",
  "notify",
]);

const S2_TOOLS: ReadonlySet<ToolScope> = new Set([
  ...S1_TOOLS,
  "queue_job",
  "request_approval",
]);

export function defaultContext(sessionId: string): AgentContext {
  return {
    sessionId,
    autonomy: "S1_ADVISE",
    allowedTools: S1_TOOLS,
  };
}

export function contextForLevel(
  sessionId: string,
  level: AutonomyLevel,
  operatorId?: string,
): AgentContext {
  const allowedTools =
    level === "S3_BOUNDED_ACT"
      ? S2_TOOLS
      : level === "S2_HUMAN_GATED"
        ? S2_TOOLS
        : S1_TOOLS;
  return { sessionId, operatorId, autonomy: level, allowedTools };
}

export function proposeAction(
  ctx: AgentContext,
  tool: ToolScope,
  intent: string,
  payload: Record<string, unknown> = {},
): AgentAction {
  if (!ctx.allowedTools.has(tool)) {
    throw new Error(`Tool "${tool}" is outside allowed scope for ${ctx.autonomy}`);
  }
  const sideEffect =
    tool === "queue_job" || tool === "request_approval" || tool === "notify";
  const requiresApproval =
    ctx.autonomy === "S1_ADVISE"
      ? sideEffect || tool !== "read_public_data"
      : ctx.autonomy === "S2_HUMAN_GATED"
        ? sideEffect
        : false;

  return {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    tool,
    intent,
    payload,
    requiresApproval,
  };
}

export function resolveAction(
  ctx: AgentContext,
  action: AgentAction,
  approved: boolean,
): AgentResult {
  if (action.requiresApproval && !approved) {
    return {
      actionId: action.id,
      status: "queued_for_approval",
      message: "Human approval required before execution (ADR-006 / human authority).",
    };
  }
  if (action.requiresApproval && approved && !ctx.operatorId) {
    return {
      actionId: action.id,
      status: "rejected",
      message: "Approved actions require operatorId on context.",
    };
  }
  if (ctx.autonomy === "S1_ADVISE" && action.requiresApproval) {
    return {
      actionId: action.id,
      status: "advised",
      message: `S1 advise-only: ${action.intent}`,
    };
  }
  return {
    actionId: action.id,
    status: "executed",
    message: `Executed ${action.tool}: ${action.intent}`,
  };
}

export const AGENT_RUNTIME_VERSION = "1.0.0" as const;
