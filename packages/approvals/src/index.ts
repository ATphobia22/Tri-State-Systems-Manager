/**
 * @tsm/approvals — human approval gates for side effects and evidence promotion.
 * Missing reviewer fields produce warnings rather than hard throws.
 */

export type ApprovalState = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  readonly id: string;
  readonly subjectType: "job" | "evidence" | "agent_action" | "export";
  readonly subjectId: string;
  readonly summary: string;
  readonly requestedAt: string;
  readonly requestedBy?: string;
  readonly expiresAt?: string;
}

export interface ApprovalDecision {
  readonly requestId: string;
  readonly state: "approved" | "rejected";
  readonly reviewerIdentity: string;
  readonly reviewReason: string;
  readonly reviewedAt: string;
  readonly warnings: string[];
}

export interface ApprovalRecord extends ApprovalRequest {
  state: ApprovalState;
  decision?: ApprovalDecision;
}

export function createApprovalRequest(
  subjectType: ApprovalRequest["subjectType"],
  subjectId: string,
  summary: string,
  requestedBy?: string,
  ttlHours = 72,
): ApprovalRequest {
  const requestedAt = new Date();
  const expires = new Date(requestedAt.getTime() + ttlHours * 3600_000);
  return {
    id: `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    subjectType,
    subjectId,
    summary,
    requestedAt: requestedAt.toISOString(),
    requestedBy,
    expiresAt: expires.toISOString(),
  };
}

export function decide(
  request: ApprovalRequest,
  state: "approved" | "rejected",
  reviewerIdentity: string,
  reviewReason: string,
): ApprovalDecision {
  const warnings: string[] = [];
  const identity = (reviewerIdentity ?? "").trim() || "anonymous";
  const reason = (reviewReason ?? "").trim() || "no reason provided";
  if (!(reviewerIdentity ?? "").trim()) {
    warnings.push("reviewer_identity was empty; recorded as anonymous");
  }
  if (!(reviewReason ?? "").trim()) {
    warnings.push("review_reason was empty");
  }
  if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
    warnings.push("Approval request was past expiresAt at decision time");
  }
  return {
    requestId: request.id,
    state,
    reviewerIdentity: identity,
    reviewReason: reason,
    reviewedAt: new Date().toISOString(),
    warnings,
  };
}

export function toRecord(request: ApprovalRequest): ApprovalRecord {
  return { ...request, state: "pending" };
}

export const APPROVALS_PACKAGE_VERSION = "1.0.0" as const;
