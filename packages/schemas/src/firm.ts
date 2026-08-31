export type FirmValidationStatus =
  | 'pending'
  | 'validated'
  | 'provisional'
  | 'failed_closed'
  | 'rejected'
  | 'stale';

export interface FirmSourceArtifact {
  filename: string;
  media_type: string;
  sha256: string;
  classification: 'AUTHORITATIVE_SOURCE_ARTIFACT' | 'CANDIDATE_SOURCE_ARTIFACT';
  validation_status: FirmValidationStatus;
}

export interface FirmWorldFileCandidate {
  filename: string;
  media_type: string;
  sha256: string;
  declared_panel_from_filename: string;
  association_status: 'VALIDATED' | 'REJECTED_PANEL_ID_MISMATCH';
}

export interface FirmSourceManifest {
  schema_version: string;
  panel_number: string;
  community: string;
  effective_date: string | null;
  source_authority: string;
  source_artifact: FirmSourceArtifact;
  world_file_candidates: FirmWorldFileCandidate[];
  georeferencing: {
    status: 'VALIDATED' | 'FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE';
    horizontal_crs: string | null;
    vertical_reference: string | null;
    transformation_chain: readonly unknown[];
  };
  governance: {
    human_review_status: 'required' | 'approved';
    publication_status: 'source-only' | 'public-derived';
    notes: string;
  };
}
