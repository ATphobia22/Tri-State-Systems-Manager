/** Typed loader contracts for the TSM public-interest engineering console. */
import type { SiteConstants } from './site';
export interface AuthContext { uid: string; tenantId: string; roles: string[]; classificationMax: 'public' | 'internal' | 'restricted' | 'confidential'; authenticatedAt: string; }
export interface RootLoaderData { auth: AuthContext | null; systemClock: string; siteSummary: { address: string; apn: string; bfe: number; lag: number; clearanceAboveBfe: number }; }
export interface CharterLoaderData { charterVersion: string; memorialName: string; principle: string; humanAuthorityRule: string; }
export interface ArchitectureLoaderData { trustPlanes: Array<{ level: number; name: string; description: string }>; coreFlow: string[]; }
export interface NeedsLoaderData { selectedLocation: { id: string; level: 'region' | 'county' | 'township' | 'municipality'; name: string }; metrics: { housing: number; mobility: number; healthcare: number; employment: number; food: number; education: number; safety: number }; dataContractId: string; deidentified: true; source: string; }
export interface EvidenceBlock { evidence_id: string; source_org: string; source_uri: string; tier: 0 | 1 | 2 | 3 | 4 | 5 | 6; state: 'OBSERVED' | 'DERIVED' | 'MODELED' | 'ADJUDICATED'; sha256_hash: string; merkle_proof?: string[]; validation_status: 'pending' | 'verified' | 'rejected'; acquired_at: string; confidence_score: number; }
export interface LedgerLoaderData { blocks: EvidenceBlock[]; merkleRoot: string | null; totalCount: number; }
export interface DataContractSummary { id: string; title: string; owner: string; classification: 'public' | 'internal' | 'restricted' | 'confidential'; jurisdiction: string; validation_status: string; content_hash: string; }
export interface LineageLoaderData { contracts: DataContractSummary[]; }
export interface SandboxProject { id: string; title: string; pi: string; irb_status: string; sandbox_tier: string; status: string; }
export interface SandboxLoaderData { projects: SandboxProject[]; }
export interface InterventionRecord { id: string; intervention_name: string; cost_estimate: string; safety_impact: number; economic_impact: number; health_impact: number; equity_impact: number; resilience_impact: number; ai_confidence: number; funding_probability: number; human_authorization_required: true; status: 'draft' | 'pending_human_review' | 'authorized' | 'rejected'; }
export interface BenefitLoaderData { interventions: InterventionRecord[]; }
export interface MapTwinLoaderData {
  site: SiteConstants;
  stage: {
    source: 'NOAA' | 'USGS' | 'UNAVAILABLE'; gaugeId: string; value_ft: number | null; timestamp: string | null;
    retrievedAt: string | null; status: 'current' | 'provisional' | 'stale' | 'unavailable';
    floodCategory: 'normal' | 'action' | 'minor' | 'moderate' | 'major' | 'unknown';
    vertical_reference: 'GAGE_DATUM'; wse_navd88_ft: number | null; gage_zero_navd88_ft: number | null; conversion_applied: boolean;
  };
  fema: { communityNumber: string; bfe_ft: number; lag_ft: number; clearance_ft: number; noRiseTolerance_ft: number };
  boundingEnvelope: { minLon: number; minLat: number; maxLon: number; maxLat: number };
}
export interface OpenMIExchangeItemDescriptor { id: string; caption: string; description: string; valueDefinition: { type: 'Quantity' | 'Quality'; unit?: string; valueType: string }; spatialDefinition: string; temporalDefinition: string; providerComponentId: string; }
