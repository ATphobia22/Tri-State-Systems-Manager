/**
 * Evidence factory — Evidence & Data Governance Plane (client helpers)
 *
 * Authoritative ledger is server-side. These helpers produce correctly shaped
 * EvidenceArtifact records for local display and for POST to /api/ledger/append.
 */

import type { EvidenceArtifact, AuthorityClass, DerivationClass } from '../types/evidence';
import { SITE } from '../types/site';

const LEAF_PREFIX = 'TSM_LEAF:';

async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createObservationArtifact(input: {
  source_authority: string;
  source_uri: string;
  source_identifier?: string;
  observation_time?: string | null;
  payload: unknown;
  authority_class?: AuthorityClass;
  is_simulation_demo?: boolean;
}): Promise<EvidenceArtifact> {
  const artifact_id = `ART-${crypto.randomUUID()}`;
  const canonical = JSON.stringify({
    artifact_id,
    ...input,
    retrieved_at: new Date().toISOString(),
  });
  const content_hash_sha256 = await sha256(LEAF_PREFIX + canonical);

  return {
    artifact_id,
    artifact_type: 'hydrologic_observation',
    source_authority: input.source_authority,
    source_uri: input.source_uri,
    source_identifier: input.source_identifier,
    retrieved_at: new Date().toISOString(),
    observation_time: input.observation_time ?? null,
    spatial_reference: {
      horizontal_crs: `EPSG:${SITE.crs.horizontalEpsg}`,
      horizontal_crs_name: SITE.crs.horizontalName,
      units: 'US survey feet',
    },
    vertical_reference: {
      vertical_datum: SITE.crs.verticalDatum,
      units: 'ft',
    },
    content_hash_sha256,
    parent_artifacts: [],
    transformation_chain: [],
    validation_status: input.is_simulation_demo ? 'provisional' : 'pending',
    authority_class: input.authority_class || (input.is_simulation_demo ? 'SIMULATION_DEMO' : 'OBSERVATION'),
    derivation_class: 'RAW',
    software_version: 'tsm-console@0.2.0',
    operator_or_service_identity: 'tsm-client',
    governance_status: 'human_review_required',
    is_simulation_demo: input.is_simulation_demo ?? false,
    human_review_status: 'pending',
  };
}

/** Explicit labels for any hard-coded or slider-driven values */
export const DEMO_DISCLAIMER =
  'SIMULATION / DEMO DATA — not live telemetry, not an engineering prediction, not a regulatory determination.';

export const FRE702_NOTE =
  'FRE 702 / Daubert: cryptographic integrity of an artifact does not by itself establish scientific reliability or courtroom admissibility. Human expert testimony and methodology validation are required.';
