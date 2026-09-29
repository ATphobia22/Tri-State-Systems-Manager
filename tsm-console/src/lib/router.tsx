/** React Router data router for the community-scale engineering console. */

import { Suspense, lazy } from 'react';
import { createBrowserRouter, redirect, useLoaderData, type ActionFunctionArgs } from 'react-router';
import { getSession, requireAuthenticatedMutation } from './auth';
import { SITE } from '../types/site';
import { appendEvidence, getMerkleState } from './merkle';
import { fetchLiveStage } from './stage';
import { t } from './design-tokens';
import RootLayout from '../components/RootLayout';
import RouteErrorPage from '../components/RouteErrorPage';
import CharterView from '../routes/CharterView';
import NeedsView from '../routes/NeedsView';
import LedgerView from '../routes/LedgerView';
import BenefitView from '../routes/BenefitView';
import LineageView from '../routes/LineageView';
import RiverWatchView from '../routes/RiverWatchView';
import EngineeringSectionView from '../routes/EngineeringSectionView';
import LoginView from '../routes/LoginView';
import LoginCallbackView from '../routes/LoginCallbackView';
import PublicDataFabricDashboard from '../components/PublicDataFabricDashboard';
// DigitalTwinV2View pulls in maplibre-gl (~1 MB vendor chunk + 82 KB CSS).
// Lazy-load it so map code leaves the critical path for non-map visitors.
const DigitalTwinV2View = lazy(() => import('../routes/DigitalTwinV2View'));
import type { RootLoaderData, CharterLoaderData, ArchitectureLoaderData, NeedsLoaderData, LedgerLoaderData, LineageLoaderData, BenefitLoaderData, MapTwinLoaderData, EvidenceBlock, InterventionRecord, DataContractSummary } from '../types/loaders';

let interventions: InterventionRecord[] = [];
let contracts: DataContractSummary[] = [
  { id: 'tsm-hydro-001', title: 'Tri-State River Stage Observations', owner: 'USGS / NOAA NWS', classification: 'public', jurisdiction: 'Federal', validation_status: 'validated', content_hash: 'sha256:pending' },
  { id: 'tsm-fema-posey-001', title: 'Posey County FIS / FIRM Reference', owner: 'FEMA', classification: 'public', jurisdiction: 'Federal', validation_status: 'validated', content_hash: 'sha256:pending' },
  { id: 'tsm-engineering-community-001', title: 'Community Engineering Evidence', owner: 'TSM Engineering Evidence', classification: 'internal', jurisdiction: 'Indiana', validation_status: 'review_required', content_hash: 'sha256:pending' },
];

async function rootLoader(): Promise<RootLoaderData> {
  const [stage] = await Promise.all([fetchLiveStage()]);
  return {
    auth: getSession(),
    stage,
    systemClock: new Date().toISOString(),
    communitySummary: { scope: 'Lower Wabash–Ohio Confluence Community', township: 'Point Township / regional community scope', county: SITE.county, region: SITE.region },
  };
}

async function charterLoader(): Promise<CharterLoaderData> {
  return { charterVersion: '1.0.0', memorialName: 'Community Stewardship Charter', principle: 'Technology is a stewardship of knowledge and capability. Its purpose is to protect life, strengthen communities, expand opportunity, preserve truth, respect human dignity, and serve people without discrimination.', humanAuthorityRule: 'The system informs people; it does not silently govern people. Human authority remains final.' };
}

async function architectureLoader(): Promise<ArchitectureLoaderData> {
  // ADR-005: canonical FOUR-plane model (see data/schemas/tsm-four-plane-architecture-v1.json).
  return { trustPlanes: [
    { level: 1, name: 'Evidence & Data Governance Plane', description: 'Authoritative ingestion (USGS/NOAA/3DEP/NFHL), immutable snapshots, SHA-256 content addressing, provenance manifests, fail-closed ingestion.' },
    { level: 2, name: 'Scientific & Simulation Plane', description: 'Versioned model inputs, explicit uncertainty propagation, traceable HAZUS/BCA adapters, explicit CRS/datum transformations; derived geometry tagged DERIVED, never AUTHORITATIVE.' },
    { level: 3, name: 'Governance & Decision Plane', description: 'Jurisdiction profiles, machine-readable policies, human approval gates, AI governance, evidence-ledger adjudication, public audit trail; no AI result silently becomes a regulatory determination.' },
    { level: 4, name: 'Public Experience / Visualization Plane', description: 'MapLibre/WebGPU clients, 2D/3D terrain, telemetry displays, accessibility-first low-bandwidth UI, downloadable evidence packages, source provenance visible in UI.' },
  ], coreFlow: ['Source', 'Evidence', 'Validation', 'Context', 'Model', 'Human Decision', 'Outcome'] };
}

async function needsLoader({ request }: { request: Request }): Promise<NeedsLoaderData> {
  const url = new URL(request.url); const locationId = url.searchParams.get('location') || 'tri_state';
  const baselines: Record<string, NeedsLoaderData> = {
    tri_state: { selectedLocation: { id: 'tri_state', level: 'region', name: 'Tri-State River Valley' }, metrics: { housing: 47, mobility: 23, healthcare: 40, employment: 28, food: 15, education: 18, safety: 12 }, dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate' },
    posey: { selectedLocation: { id: 'posey', level: 'county', name: 'Posey County' }, metrics: { housing: 42, mobility: 28, healthcare: 35, employment: 25, food: 12, education: 15, safety: 10 }, dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate' },
    point: { selectedLocation: { id: 'point', level: 'township', name: 'Point Township' }, metrics: { housing: 38, mobility: 45, healthcare: 42, employment: 30, food: 18, education: 20, safety: 8 }, dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate' },
    mt_vernon: { selectedLocation: { id: 'mt_vernon', level: 'municipality', name: 'Mount Vernon' }, metrics: { housing: 52, mobility: 18, healthcare: 38, employment: 32, food: 22, education: 25, safety: 15 }, dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate' },
  };
  return baselines[locationId] || baselines.tri_state;
}

async function ledgerLoader(): Promise<LedgerLoaderData> { const { leaves, root } = getMerkleState(); const blocks: EvidenceBlock[] = leaves.map((l) => { const p = l.payload as Record<string, unknown>; return { evidence_id: l.id, source_org: String(p.source_org || ''), source_uri: String(p.source_uri || ''), tier: (p.tier as EvidenceBlock['tier']) ?? 1, state: 'OBSERVED', sha256_hash: l.hash, validation_status: (p.validation_status as EvidenceBlock['validation_status']) || 'pending', acquired_at: l.createdAt, confidence_score: 0.95 }; }); return { blocks, merkleRoot: root, totalCount: blocks.length }; }
async function ledgerAction({ request }: ActionFunctionArgs) {
  requireAuthenticatedMutation(request);
  const form = await request.formData();
  const source_org = String(form.get('source_org') || '').trim();
  const source_uri = String(form.get('source_uri') || '').trim();
  const tier = Number.parseInt(String(form.get('tier') || '1'), 10);
  const human_authorized = form.get('human_authorization') === 'true';
  const reviewer_identity = String(form.get('reviewer_identity') || '').trim();
  const review_reason = String(form.get('review_reason') || '').trim();
  if (!source_org || !source_uri || !reviewer_identity || !review_reason || !human_authorized) {
    return { error: 'FAIL_CLOSED: Human Authority Sign, reviewer identity, and review reason are required before Merkle append.' };
  }
  await appendEvidence({
    source_org,
    source_uri,
    tier,
    human_authorization: {
      human_authorized: true,
      reviewer_identity,
      review_reason,
      reviewed_at: new Date().toISOString(),
    },
  });
  return redirect('/ledger');
}
async function lineageLoader(): Promise<LineageLoaderData> { return { contracts: [...contracts] }; }
async function lineageAction({ request }: ActionFunctionArgs) { requireAuthenticatedMutation(request); const form = await request.formData(); const id = String(form.get('id') || '').trim(); const title = String(form.get('title') || '').trim(); const owner = String(form.get('owner') || '').trim(); const classification = String(form.get('classification') || 'internal') as DataContractSummary['classification']; const jurisdiction = String(form.get('jurisdiction') || 'Indiana').trim(); if (!id || !title || !owner) return { error: 'Missing fields' }; contracts = [{ id, title, owner, classification, jurisdiction, validation_status: 'pending', content_hash: 'sha256:pending' }, ...contracts]; return redirect('/lineage'); }
async function benefitLoader(): Promise<BenefitLoaderData> { return { interventions: [...interventions] }; }
async function benefitAction({ request }: ActionFunctionArgs) { requireAuthenticatedMutation(request); const form = await request.formData(); const name = String(form.get('name') || '').trim(); const cost = String(form.get('cost') || '').trim(); if (!name || !cost) return { error: 'Missing fields' }; const rec: InterventionRecord = { id: `INT-${Date.now()}`, intervention_name: name, cost_estimate: cost, safety_impact: 80, economic_impact: 75, health_impact: 70, equity_impact: 78, resilience_impact: 85, ai_confidence: 0, funding_probability: 0, human_authorization_required: true, status: 'pending_human_review' }; interventions = [rec, ...interventions]; return redirect('/benefit'); }
async function mapTwinLoader(): Promise<MapTwinLoaderData> { const stage = await fetchLiveStage(); return { site: SITE, stage, fema: { communityNumber: SITE.femaCommunities.mountVernon, bfe_ft: SITE.elevations.bfe_ft, lag_ft: SITE.elevations.lag_ft, clearance_ft: SITE.elevations.clearanceAboveBfe_ft, noRiseTolerance_ft: null }, boundingEnvelope: SITE.boundingEnvelope }; }
function ArchitectureView() { const data = useLoaderData() as ArchitectureLoaderData; return <div style={{ padding: '1.5rem 2rem', maxWidth: 900, margin: '0 auto' }}><h1 style={{ color: t.color.text.primary }}>Four Trust Planes</h1><p style={{ color: t.color.text.secondary, fontSize: t.font.size.lg }}>{data.coreFlow.join(' → ')}</p>{data.trustPlanes.map((p) => <div key={p.level} style={{ background: t.color.surface.card, borderRadius: t.radius.lg, padding: '1rem', marginBottom: 8 }}><strong style={{ color: t.color.accent.brand }}>L{p.level}</strong>{' '}<span style={{ color: t.color.text.primary }}>{p.name}</span><p style={{ color: t.color.text.secondary, fontSize: t.font.size.base, margin: '0.35rem 0 0' }}>{p.description}</p></div>)}</div>; }

/**
 * Shared loading fallback for lazily-loaded routes. React Router renders
 * `hydrateFallbackElement` while a route's `lazy()` chunk is being fetched, so
 * a chunk failure can never leave a blank page — the root `errorElement` (see
 * below) takes over if the chunk itself errors.
 */
function RouteLoadingFallback({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: '2rem', color: t.color.text.secondary, background: t.color.surface.base, minHeight: '40vh', fontSize: t.font.size.base }}>
      Loading {label}…
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * ROUTE MAP (Phase 2 visual-system decision)
 *
 * The four twin surfaces were near-duplicates in the nav. They are NOT merged —
 * each is a genuinely different working surface — but they are now clearly
 * differentiated by nav label, document.title (RouteTitle.tsx), and purpose:
 *
 *   /map            "Hydraulic Map"   — 2D MapLibre map with stage/jurisdiction
 *                                        visualization controls. Nav: yes.
 *   /twin           "Twin Canvas"     — full-bleed twin canvas, minimal chrome;
 *                                        hosts the cinematic tour. Nav: yes.
 *   /digital-twin   "Twin Summary"    — card summary: elevations, live gauges,
 *                                        clearance. DELIBERATE DEEP LINK: kept
 *                                        out of the nav to avoid a fourth map
 *                                        entry; reachable from the Twin Canvas
 *                                        footer ("Twin summary").
 *   /digital-twin-v2 "Digital Twin 3D" — immersive open-world 3D twin app.
 *                                        React.lazy()'d off the critical path
 *                                        (maplibre-gl ~1 MB must never block
 *                                        first paint for non-map visitors).
 *                                        Nav: yes ("3D Twin").
 *
 * Orphaned routes made reachable (Phase 2):
 *   /eoc         "EOC Surface"   — decision-support dashboard; added to nav.
 *   /data-fabric "Data Fabric"   — public data fabric dashboard; added to nav.
 *
 * Every route inherits the root `errorElement` (RouteErrorPage) so loader or
 * chunk failures render a recoverable error page instead of a blank screen.
 * ------------------------------------------------------------------------- */

const routerBasename = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL.slice(0, -1) || '/'
  : import.meta.env.BASE_URL;

export const router = createBrowserRouter([
  { path: 'login', element: <LoginView /> },
  { path: 'login/callback', element: <LoginCallbackView /> },
  { id: 'root', path: '/', loader: rootLoader, element: <RootLayout />, errorElement: <RouteErrorPage />, children: [
  { index: true, loader: charterLoader, element: <CharterView /> },
  { path: 'architecture', loader: architectureLoader, element: <ArchitectureView /> },
  { path: 'data-fabric', element: <PublicDataFabricDashboard /> },
  { path: 'river-watch', element: <RiverWatchView /> },
  { path: 'engineering-section', element: <EngineeringSectionView /> },
  { path: 'needs', loader: needsLoader, element: <NeedsView /> },
  { path: 'ledger', loader: ledgerLoader, action: ledgerAction, element: <LedgerView /> },
  { path: 'lineage', loader: lineageLoader, action: lineageAction, element: <LineageView /> },
  { path: 'benefit', loader: benefitLoader, action: benefitAction, element: <BenefitView /> },
  { path: 'map', loader: mapTwinLoader, hydrateFallbackElement: <RouteLoadingFallback label="the hydraulic map" />, lazy: async () => ({ Component: (await import('../routes/MapLibreMap')).default }) },
  { path: 'eoc', loader: mapTwinLoader, hydrateFallbackElement: <RouteLoadingFallback label="the EOC surface" />, lazy: async () => ({ Component: (await import('../routes/MapLibreEocView')).default }) },
  { path: 'twin', loader: mapTwinLoader, hydrateFallbackElement: <RouteLoadingFallback label="the twin canvas" />, lazy: async () => ({ Component: (await import('../routes/TwinCanvasView')).default }) },
  { path: 'digital-twin', loader: mapTwinLoader, hydrateFallbackElement: <RouteLoadingFallback label="the twin summary" />, lazy: async () => ({ Component: (await import('../routes/MapTwinView')).default }) },
  { path: 'digital-twin-v2', element: <Suspense fallback={<RouteLoadingFallback label="the 3D digital twin" />}><DigitalTwinV2View /></Suspense> },
  { path: 'flood-sim', hydrateFallbackElement: <RouteLoadingFallback label="the flood simulator" />, lazy: async () => ({ Component: (await import('../components/FloodSimulator')).default }) },
  { path: 'posey-resilience', hydrateFallbackElement: <RouteLoadingFallback label="the Posey resilience platform" />, lazy: async () => ({ Component: (await import('../routes/PoseyResilienceDashboard')).default }) },
] },
], { basename: routerBasename });
