export type JobKind =
  | "ingest_usgs_stage"
  | "ingest_nfhl_layer"
  | "build_h3_index"
  | "export_evidence_ledger"
  | "hec_ras_package_hash"
  | "crs_datum_report"
  | "notification_dispatch";

export type JobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "awaiting_approval";

export interface JobSpec {
  readonly id: string;
  readonly kind: JobKind;
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly payload: Record<string, unknown>;
  readonly humanReviewRequired: boolean;
}

export interface JobRecord extends JobSpec {
  status: JobStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  resultRef?: string;
}

export function createJob(
  kind: JobKind,
  payload: Record<string, unknown>,
  createdBy?: string,
): JobSpec {
  const humanReviewRequired =
    kind === "hec_ras_package_hash" ||
    kind === "crs_datum_report" ||
    kind === "export_evidence_ledger";

  return {
    id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    createdAt: new Date().toISOString(),
    createdBy,
    payload,
    humanReviewRequired,
  };
}

export function toPendingRecord(spec: JobSpec): JobRecord {
  return {
    ...spec,
    status: spec.humanReviewRequired ? "awaiting_approval" : "pending",
  };
}

export const JOBS_PACKAGE_VERSION = "1.0.0" as const;
