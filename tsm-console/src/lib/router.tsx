/** React Router data router for the community-scale engineering console. */

import { createBrowserRouter, redirect, useLoaderData, type ActionFunctionArgs } from 'react-router';
import { getSession, requireAuthenticatedMutation } from './auth';
import { SITE } from '../types/site';
import { appendEvidence, getMerkleState } from './merkle';
import { fetchLiveStage } from './stage';
import RootLayout from '../components/RootLayout';
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
  return { trustPlanes: [
    { level: 1, name: 'Physical & Digital Infrastructure', description: 'USGS 3DEP, telemetry, terrain, transportation and utility evidence.' },
    { level: 2, name: 'Evidence, Provenance & Audit', description: 'Cryptographic evidence, SHA-256, Merkle roots and reproducible artifacts.' },
    { level: 3, name: 'Security, Privacy & Identity', description: 'Zero-Trust access controls and privacy-by-design community scope.' },
    { level: 4, name: 'Data Fabric & Metadata Lineage', description: 'Authoritative-source contracts, units, CRS, datum and freshness.' },
    { level: 5, name: 'Analytics & Knowledge Graph', description: 'Connected community assets, river influence and infrastructure dependencies.' },
    { level: 6, name: 'AI, Science & Simulation', description: 'HEC-RAS and engineering models remain evidence/model outputs, not regulatory decisions.' },
    { level: 7, name: 'Decision Support & Human Authority', description: 'Human-in-the-loop engineering and agency review gates.' },
    { level: 8, name: 'Community Service & Accessibility', description: 'Readable river watch, low-bandwidth operation and human fallback.' },
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
function ArchitectureView() { const data = useLoaderData() as ArchitectureLoaderData; return <div style={{ padding: '1.5rem 2rem', maxWidth: 900, margin: '0 auto' }}><h1 style={{ color: '#f8fafc' }}>Eight Trust Planes</h1><p style={{ color: '#64748b', fontSize: '0.85rem' }}>{data.coreFlow.join(' → ')}</p>{data.trustPlanes.map((p) => <div key={p.level} style={{ background: '#1e293b', borderRadius: 12, padding: '1rem', marginBottom: 8 }}><strong style={{ color: '#38bdf8' }}>L{p.level}</strong>{' '}<span style={{ color: '#f8fafc' }}>{p.name}</span><p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.35rem 0 0' }}>{p.description}</p></div>)}</div>; }

const routerBasename = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL.slice(0, -1) || '/'
  : import.meta.env.BASE_URL;

export const router = createBrowserRouter([
  { path: 'login', element: <LoginView /> },
  { path: 'login/callback', element: <LoginCallbackView /> },
  { id: 'root', path: '/', loader: rootLoader, element: <RootLayout />, children: [
  { index: true, loader: charterLoader, element: <CharterView /> },
  { path: 'architecture', loader: architectureLoader, element: <ArchitectureView /> },
  { path: 'data-fabric', element: <PublicDataFabricDashboard /> },
  { path: 'river-watch', element: <RiverWatchView /> },
  { path: 'engineering-section', element: <EngineeringSectionView /> },
  { path: 'needs', loader: needsLoader, element: <NeedsView /> },
  { path: 'ledger', loader: ledgerLoader, action: ledgerAction, element: <LedgerView /> },
  { path: 'lineage', loader: lineageLoader, action: lineageAction, element: <LineageView /> },
  { path: 'benefit', loader: benefitLoader, action: benefitAction, element: <BenefitView /> },
  { path: 'map', loader: mapTwinLoader, lazy: async () => ({ Component: (await import('../routes/MapLibreMap')).default }) },
  { path: 'eoc', loader: mapTwinLoader, lazy: async () => ({ Component: (await import('../routes/MapLibreEocView')).default }) },
  { path: 'twin', loader: mapTwinLoader, lazy: async () => ({ Component: (await import('../routes/TwinCanvasView')).default }) },
  { path: 'digital-twin', loader: mapTwinLoader, lazy: async () => ({ Component: (await import('../routes/MapTwinView')).default }) },
] },
], { basename: routerBasename });
