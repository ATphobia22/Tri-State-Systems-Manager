export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  action: string;
  requestedBy: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
  createdAt: string;
}

export class ApprovalGate {
  private readonly requests = new Map<string, ApprovalRequest>();
  private counter = 0;

  public request(action: string, requestedBy: string, payload: Record<string, unknown> = {}): ApprovalRequest {
    const approval: ApprovalRequest = {
      id: `approval-${++this.counter}`,
      action,
      requestedBy,
      payload,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.requests.set(approval.id, approval);
    return approval;
  }

  public approve(id: string, decidedBy: string, reason?: string): ApprovalRequest {
    return this.decide(id, decidedBy, "approved", reason);
  }

  public reject(id: string, decidedBy: string, reason?: string): ApprovalRequest {
    return this.decide(id, decidedBy, "rejected", reason);
  }

  public get(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  public pending(): ApprovalRequest[] {
    return [...this.requests.values()].filter((r) => r.status === "pending");
  }

  private decide(id: string, decidedBy: string, status: ApprovalStatus, reason?: string): ApprovalRequest {
    const approval = this.requests.get(id);
    if (!approval) throw new Error(`Unknown approval: ${id}`);
    if (approval.status !== "pending") throw new Error(`Approval ${id} is already ${approval.status}`);
    approval.status = status;
    approval.decidedBy = decidedBy;
    approval.decidedAt = new Date().toISOString();
    approval.reason = reason;
    return approval;
  }
}
