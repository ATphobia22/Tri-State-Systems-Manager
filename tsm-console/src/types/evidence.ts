/**
 * EvidenceArtifact — canonical contract for the Evidence & Data Governance Plane
 *
 * Distinction chain (never collapse):
 * AUTHORITY → OBSERVATION → DERIVATION → MODEL → INFERENCE → VISUALIZATION
 *
 * SHA-256 proves integrity only — not scientific truth, legal admissibility, or FRE 702 compliance.
 */

export type AuthorityClass =
  | 'OBSERVATION'
  | 'FORECAST'
  | 'REGULATORY'
  | 'DERIVED'
  | 'MODEL_OUTPUT'
  | 'INFERENCE'
  | 'VISUALIZATION'
  | 'SIMULATION_DEMO';

export type DerivationClass =
  | 'RAW'
  | 'TRANSFORMED'
  | 'AGGREGATED'
  | 'MODELED'
  | 'INFERRED'
  | 'RENDERED';

export type ValidationStatus =
  | 'pending'
  | 'validated'
  | 'rejected'
  | 'stale'
  | 'provisional'
  | 'failed_closed';

export type GovernanceStatus =
  | 'draft'
  | 'human_review_required'
  | 'human_authorized'
  | 'published'
  | 'superseded'
  | 'withdrawn';

export interface SpatialReference {
  horizontal_crs: string; // e.g. "EPSG:2966"
  horizontal_crs_name?: string;
  units?: string;
}

export interface VerticalReference {
  vertical_datum: string; // e.g. "NAVD88"
  units?: string;
  /** Never conflate with horizontal CRS */
}

export interface TransformationStep {
  step: number;
  operation: string;
  from: string;
  to: string;
  software?: string;
  parameters?: Record<string, unknown>;
}

export interface EvidenceArtifact {
  artifact_id: string;
  artifact_type: string;
  source_authority: string;
  source_uri: string;
  source_identifier?: string;
  retrieved_at: string;
  observation_time?: string | null;
  spatial_reference: SpatialReference;
  vertical_reference: VerticalReference;
  source_version?: string;
  content_hash_sha256: string;
  parent_artifacts: string[];
  transformation_chain: TransformationStep[];
  validation_status: ValidationStatus;
  uncertainty?: {
    value?: number;
    unit?: string;
    method?: string;
    notes?: string;
  };
  authority_class: AuthorityClass;
  derivation_class: DerivationClass;
  model_version?: string;
  software_version?: string;
  operator_or_service_identity?: string;
  governance_status: GovernanceStatus;
  supersedes?: string | null;
  superseded_by?: string | null;
  /** Explicit flag: client-side or demo data must set true */
  is_simulation_demo?: boolean;
  human_review_status?: string;
  notes?: string;
}

/** Four-plane system identifiers */
export type SystemPlane =
  | 'EVIDENCE_DATA_GOVERNANCE'
  | 'SCIENTIFIC_SIMULATION'
  | 'GOVERNANCE_DECISION'
  | 'PUBLIC_EXPERIENCE_VISUALIZATION';
