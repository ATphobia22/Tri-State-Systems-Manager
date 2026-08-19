/**
 * TuckerInc.82 — Tri-State Systems Manager
 * Exact loader data structures for React Router v7
 * Version 1.0.0 — 2026-08-19
 *
 * All structures are designed for:
 * - Zero-Trust identity (NIST SP 800-207)
 * - Data Contract Schema compliance
 * - Daubert-ready provenance (testable, peer-reviewable, known error bounds, accepted methods)
 * - Future OpenMI 2.0 coupling (IBaseExchangeItem / IBaseInput / IBaseOutput patterns)
 */

import type { SiteConstants } from './site';

/** Authenticated session context passed by the parent auth loader. Never contains PII beyond uid. */
export interface AuthContext {
  uid: string;
  tenantId: string;
  roles: string[];
  classificationMax: 'public' | 'internal' | 'restricted' | 'confidential';
  authenticatedAt: string; // ISO-8601
}

/** Root layout loader data */
export interface RootLoaderData {
  auth: AuthContext | null;
  systemClock: string;
  siteSummary: {
    address: string;
    apn: string;
    bfe: number;
    lag: number;
    clearanceAboveBfe: number;
  };
}

/** / (Charter) loader data */
export interface CharterLoaderData {
  charterVersion: string;
  memorialName: string;
  principle: string;
  humanAuthorityRule: string;
}

/** /architecture loader data */
export interface ArchitectureLoaderData {
  trustPlanes: Array<{
    level: number;
    name: string;
    description: string;
  }>;
  coreFlow: string[];
}

/** /needs loader data — spatial + CASOA aggregate metrics */
export interface NeedsLoaderData {
  selectedLocation: {
    id: string;
    level: 'region' | 'county' | 'township' | 'municipality';
    name: string;
  };
  metrics: {
    housing: number;
    mobility: number;
    healthcare: number;
    employment: number;
    food: number;
    education: number;
    safety: number;
  };
  dataContractId: string;
  deidentified: true;
  source: string;
}

/** Evidence block as returned by /ledger loader */
export interface EvidenceBlock {
  evidence_id: string;
  source_org: string;
  source_uri: string;
  tier: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  state: 'OBSERVED' | 'DERIVED' | 'MODELED' | 'ADJUDICATED';
  sha256_hash: string;
  merkle_proof?: string[];
  validation_status: 'pending' | 'verified' | 'rejected';
  acquired_at: string;
  confidence_score: number;
}

export interface LedgerLoaderData {
  blocks: EvidenceBlock[];
  merkleRoot: string | null;
  totalCount: number;
}

/** /lineage — Data Contract catalog entries */
export interface DataContractSummary {
  id: string;
  title: string;
  owner: string;
  classification: 'public' | 'internal' | 'restricted' | 'confidential';
  jurisdiction: string;
  validation_status: string;
  content_hash: string;
}

export interface LineageLoaderData {
  contracts: DataContractSummary[];
}

/** /sandbox */
export interface SandboxProject {
  id: string;
  title: string;
  pi: string;
  irb_status: string;
  sandbox_tier: string;
  status: string;
}

export interface SandboxLoaderData {
  projects: SandboxProject[];
}

/** /benefit — interventions remain human-authorized */
export interface InterventionRecord {
  id: string;
  intervention_name: string;
  cost_estimate: string;
  safety_impact: number;
  economic_impact: number;
  health_impact: number;
  equity_impact: number;
  resilience_impact: number;
  ai_confidence: number;
  funding_probability: number;
  human_authorization_required: true;
  status: 'draft' | 'pending_human_review' | 'authorized' | 'rejected';
}

export interface BenefitLoaderData {
  interventions: InterventionRecord[];
}

/** /map and /twin — site constants + live stage context */
export interface MapTwinLoaderData {
  site: SiteConstants;
  stage: {
    source: 'NOAA' | 'USGS' | 'MOCK';
    gaugeId: string;
    value_ft: number | null;
    timestamp: string | null;
    floodCategory: 'normal' | 'action' | 'minor' | 'moderate' | 'major' | 'unknown';
  };
  fema: {
    communityNumber: string;
    bfe_ft: number;
    lag_ft: number;
    clearance_ft: number;
    noRiseTolerance_ft: number;
  };
  boundingEnvelope: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
}

/** OpenMI 2.0-inspired exchange item descriptor (Phase 1 metadata only) */
export interface OpenMIExchangeItemDescriptor {
  id: string;
  caption: string;
  description: string;
  valueDefinition: {
    type: 'Quantity' | 'Quality';
    unit?: string;
    valueType: string;
  };
  spatialDefinition: string; // e.g. element set reference
  temporalDefinition: string; // e.g. time horizon
  providerComponentId: string;
}
