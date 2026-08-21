/**
 * Evidence factory — Evidence & Data Governance Plane (client helpers)
 * Authoritative ledger is server-side.
 */

import type {
  EvidenceArtifact,
  AuthorityClass,
  DerivationClass,
  TransformationStep,
  ValidationStatus,
  GovernanceStatus,
} from '../types/evidence';
import {
  siteSpatialReference,
  siteVerticalReference,
  assertAuthoritativeHorizontal,
  buildNad83ToItrf2014Chain,
} from './geodetic';
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
  transformation_chain?: TransformationStep[];
}): Promise<EvidenceArtifact> {
  assertAuthoritativeHorizontal(SITE.crs.horizontalEpsg);

  const artifact_id = `ART-${crypto.randomUUID()}`;
  const retrieved_at = new Date().toISOString();
  const canonical = JSON.stringify({
    artifact_id,
    source_authority: input.source_authority,
    source_uri: input.source_uri,
    source_identifier: input.source_identifier,
    payload: input.payload,
    retrieved_at,
  });
  const content_hash_sha256 = await sha256(LEAF_PREFIX + canonical);

  return {
    artifact_id,
    artifact_type: 'hydrologic_observation',
    source_authority: input.source_authority,
    source_uri: input.source_uri,
    source_identifier: input.source_identifier,
    retrieved_at,
    observation_time: input.observation_time ?? null,
    spatial_reference: siteSpatialReference(),
    vertical_reference: siteVerticalReference(),
    content_hash_sha256,
    parent_artifacts: [],
    transformation_chain: input.transformation_chain ?? [],
    validation_status: input.is_simulation_demo ? 'provisional' : 'pending',
    authority_class:
      input.authority_class || (input.is_simulation_demo ? 'SIMULATION_DEMO' : 'OBSERVATION'),
    derivation_class: 'RAW',
    software_version: 'tsm-console@0.2.0',
    operator_or_service_identity: 'tsm-client',
    governance_status: 'human_review_required',
    is_simulation_demo: input.is_simulation_demo ?? false,
    human_review_status: 'pending',
  };
}

export async function createDerivedTransformArtifact(input: {
  parent_artifact_id: string;
  source_authority: string;
  source_uri: string;
  observation_epoch: string;
  target_epoch?: string;
  payload: unknown;
}): Promise<EvidenceArtifact> {
  const chain = buildNad83ToItrf2014Chain({
    observationEpoch: input.observation_epoch,
    targetEpoch: input.target_epoch,
    coseismicApplied: false,
  });

  const artifact_id = `ART-${crypto.randomUUID()}`;
  const retrieved_at = new Date().toISOString();
  const canonical = JSON.stringify({
    artifact_id,
    parent: input.parent_artifact_id,
    chain,
    payload: input.payload,
    retrieved_at,
  });
  const content_hash_sha256 = await sha256(LEAF_PREFIX + canonical);

  return {
    artifact_id,
    artifact_type: 'geodetic_transform',
    source_authority: input.source_authority,
    source_uri: input.source_uri,
    retrieved_at,
    observation_time: input.observation_epoch,
    spatial_reference: {
      horizontal_crs: 'ITRF2014',
      horizontal_crs_name: 'ITRF2014 (derived — not site analysis frame)',
      units: 'metre (geodetic)',
    },
    vertical_reference: siteVerticalReference(),
    content_hash_sha256,
    parent_artifacts: [input.parent_artifact_id],
    transformation_chain: chain,
    validation_status: 'provisional',
    authority_class: 'DERIVED',
    derivation_class: 'TRANSFORMED',
    software_version: 'tsm-console@0.2.0',
    operator_or_service_identity: 'tsm-geodetic-template',
    governance_status: 'human_review_required',
    is_simulation_demo: false,
    notes:
      'Template chain only. Numeric Helmert/HTDP must be executed offline with NGS tools before human authorization.',
  };
}

export async function createCinematicAffidavitArtifact(input: {
  sequence: number;
  content_hash_sha256: string;
  parent_artifact_id?: string;
  pipeline_version?: string;
}): Promise<EvidenceArtifact> {
  const pipeline = input.pipeline_version ?? 'tsm-viz-1.0.0';
  const seal = input.content_hash_sha256.toLowerCase().replace(/^sha256:/, '');
  const artifact_id = `AFF-${(await sha256(`${input.sequence}:${seal}:${pipeline}`)).slice(0, 16).toUpperCase()}`;
  const retrieved_at = new Date().toISOString();
  const statement = `Frame sequence ${input.sequence} associated with content hash ${seal}. Visualization plane only — not FARA/No-Rise.`;

  return {
    artifact_id,
    artifact_type: 'cinematic_affidavit',
    source_authority: 'TSM Visualization Plane',
    source_uri: 'internal:cinematic',
    retrieved_at,
    spatial_reference: siteSpatialReference(),
    vertical_reference: siteVerticalReference(),
    content_hash_sha256: seal.length === 64 ? seal : await sha256(seal),
    parent_artifacts: input.parent_artifact_id ? [input.parent_artifact_id] : [],
    transformation_chain: [],
    validation_status: 'provisional',
    authority_class: 'VISUALIZATION',
    derivation_class: 'RENDERED',
    software_version: pipeline,
    operator_or_service_identity: 'tsm-cinematic',
    governance_status: 'draft',
    is_simulation_demo: true,
    notes: statement,
  };
}

export const DEMO_DISCLAIMER =
  'SIMULATION / DEMO DATA — not live telemetry, not an engineering prediction, not a regulatory determination.';

export const FRE702_NOTE =
  'FRE 702 / Daubert: cryptographic integrity of an artifact does not by itself establish scientific reliability or courtroom admissibility. Human expert testimony and methodology validation are required.';
