/**
 * React Router v7 Data Router — full WP-1/WP-2 shell
 * Auth gate + typed loaders + actions for ledger/benefit + live stage
 */

import {
  createBrowserRouter,
  redirect,
  useLoaderData,
  type ActionFunctionArgs,
} from 'react-router';
import { authLoader } from './auth';
import { SITE } from '../types/site';
import { appendEvidence, getMerkleState } from './merkle';
import { fetchLiveStage } from './stage';
import RootLayout from '../components/RootLayout';
import CharterView from '../routes/CharterView';
import NeedsView from '../routes/NeedsView';
import LedgerView from '../routes/LedgerView';
import BenefitView from '../routes/BenefitView';
import LineageView from '../routes/LineageView';
import SandboxView from '../routes/SandboxView';
import type {
  RootLoaderData,
  CharterLoaderData,
  ArchitectureLoaderData,
  NeedsLoaderData,
  LedgerLoaderData,
  LineageLoaderData,
  SandboxLoaderData,
  BenefitLoaderData,
  MapTwinLoaderData,
  EvidenceBlock,
  InterventionRecord,
  DataContractSummary,
} from '../types/loaders';

let interventions: InterventionRecord[] = [];
let contracts: DataContractSummary[] = [
  {
    id: 'tsm-hydro-001',
    title: 'Tri-State River Stage Observations',
    owner: 'Indiana DNR / USGS NWIS',
    classification: 'restricted',
    jurisdiction: 'Indiana',
    validation_status: 'validated',
    content_hash: 'sha256:pending',
  },
  {
    id: 'tsm-fema-posey-001',
    title: 'Posey County FIS / FIRM Reference',
    owner: 'FEMA',
    classification: 'public',
    jurisdiction: 'Federal',
    validation_status: 'validated',
    content_hash: 'sha256:pending',
  },
  {
    id: 'tsm-site-001',
    title: '13101 Bonebank Site Constants',
    owner: 'TuckerInc.82',
    classification: 'restricted',
    jurisdiction: 'Indiana',
    validation_status: 'validated',
    content_hash: 'sha256:site-v1',
  },
];
let sandboxProjects: import('../types/loaders').SandboxProject[] = [];

async function rootLoader(): Promise<RootLoaderData> {
  const auth = await authLoader({});
  return {
    auth,
    systemClock: new Date().toISOString(),
    siteSummary: {
      address: SITE.address,
      apn: SITE.apn,
      bfe: SITE.elevations.bfe_ft,
      lag: SITE.elevations.lag_ft,
      clearanceAboveBfe: SITE.elevations.clearanceAboveBfe_ft,
    },
  };
}

async function charterLoader(): Promise<CharterLoaderData> {
  return {
    charterVersion: '1.0.0',
    memorialName: 'Beverly Ann Tucker Memorial Stewardship Charter',
    principle:
      'Technology is a stewardship of knowledge and capability. Its purpose is to protect life, strengthen communities, expand opportunity, preserve truth, respect human dignity, and serve people without discrimination.',
    humanAuthorityRule:
      'The system informs people; it does not silently govern people. Human authority remains final.',
  };
}

async function architectureLoader(): Promise<ArchitectureLoaderData> {
  return {
    trustPlanes: [
      { level: 1, name: 'Physical & Digital Infrastructure', description: 'USGS 3DEP, telemetry, Tucker Power PCM grids.' },
      { level: 2, name: 'Evidence, Provenance & Audit', description: 'Cryptographic ledgers, SHA-256, Merkle roots, Daubert-ready workflows.' },
      { level: 3, name: 'Security, Privacy & Identity', description: 'Zero-Trust (NIST SP 800-207), PII/PHI isolation.' },
      { level: 4, name: 'Data Fabric & Metadata Lineage', description: 'Indiana Data Strategy contracts, schema registries.' },
      { level: 5, name: 'Analytics & Knowledge Graph', description: 'De-identified asset hierarchies and human needs.' },
      { level: 6, name: 'AI, Science & Simulation', description: 'HEC-RAS, Bishop, multi-physics under NIST AI RMF; OpenMI 2.0 coupling.' },
      { level: 7, name: 'Decision Support & Human Authority', description: 'Human-in-the-loop. System informs; human decides.' },
      { level: 8, name: 'Community Service & Accessibility', description: 'WCAG, low-bandwidth, human fallback.' },
    ],
    coreFlow: ['Source', 'Evidence', 'Validation', 'Context', 'Model', 'Human Decision', 'Outcome'],
  };
}

async function needsLoader({ request }: { request: Request }): Promise<NeedsLoaderData> {
  const url = new URL(request.url);
  const locationId = url.searchParams.get('location') || 'tri_state';
  const baselines: Record<string, NeedsLoaderData> = {
    tri_state: {
      selectedLocation: { id: 'tri_state', level: 'region', name: 'Tri-State River Valley' },
      metrics: { housing: 47, mobility: 23, healthcare: 40, employment: 28, food: 15, education: 18, safety: 12 },
      dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate',
    },
    posey: {
      selectedLocation: { id: 'posey', level: 'county', name: 'Posey County' },
      metrics: { housing: 42, mobility: 28, healthcare: 35, employment: 25, food: 12, education: 15, safety: 10 },
      dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate',
    },
    point: {
      selectedLocation: { id: 'point', level: 'township', name: 'Point Township' },
      metrics: { housing: 38, mobility: 45, healthcare: 42, employment: 30, food: 18, education: 20, safety: 8 },
      dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate',
    },
    mt_vernon: {
      selectedLocation: { id: 'mt_vernon', level: 'municipality', name: 'Mount Vernon' },
      metrics: { housing: 52, mobility: 18, healthcare: 38, employment: 32, food: 22, education: 25, safety: 15 },
      dataContractId: 'tsm-casoa-aggregate-001', deidentified: true, source: 'Indiana CASOA / FSSA Aggregate',
    },
  };
  return baselines[locationId] || baselines.tri_state;
}

async function ledgerLoader(): Promise<LedgerLoaderData> {
  const { leaves, root } = getMerkleState();
  const blocks: EvidenceBlock[] = leaves.map((l) => {
    const p = l.payload as Record<string, unknown>;
    return {
      evidence_id: l.id,
      source_org: String(p.source_org || ''),
      source_uri: String(p.source_uri || ''),
      tier: (p.tier as EvidenceBlock['tier']) ?? 1,
      state: 'OBSERVED',
      sha256_hash: l.hash,
      validation_status: (p.validation_status as EvidenceBlock['validation_status']) || 'pending',
      acquired_at: l.createdAt,
      confidence_score: 0.95,
    };
  });
  return { blocks, merkleRoot: root, totalCount: blocks.length };
}

async function ledgerAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const source_org = String(form.get('source_org') || '').trim();
  const source_uri = String(form.get('source_uri') || '').trim();
  const tier = Number.parseInt(String(form.get('tier') || '1'), 10);
  if (!source_org || !source_uri) return { error: 'Missing fields' };
  await appendEvidence({ source_org, source_uri, tier });
  return redirect('/ledger');
}

async function lineageLoader(): Promise<LineageLoaderData> {
  return { contracts: [...contracts] };
}

async function lineageAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const id = String(form.get('id') || '').trim();
  const title = String(form.get('title') || '').trim();
  const owner = String(form.get('owner') || '').trim();
  const classification = String(form.get('classification') || 'internal') as DataContractSummary['classification'];
  const jurisdiction = String(form.get('jurisdiction') || 'Indiana').trim();
  if (!id || !title || !owner) return { error: 'Missing fields' };
  contracts = [{
    id, title, owner, classification, jurisdiction,
    validation_status: 'pending',
    content_hash: 'sha256:pending',
  }, ...contracts];
  return redirect('/lineage');
}

async function sandboxLoader(): Promise<import('../types/loaders').SandboxLoaderData> {
  return { projects: [...sandboxProjects] };
}

async function sandboxAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const title = String(form.get('title') || '').trim();
  const pi = String(form.get('pi') || '').trim();
  const irb_status = String(form.get('irb_status') || 'pending');
  const sandbox_tier = String(form.get('sandbox_tier') || 'deidentified');
  if (!title || !pi) return { error: 'Missing fields' };
  sandboxProjects = [{
    id: `SBX-${Date.now()}`,
    title, pi, irb_status, sandbox_tier,
    status: irb_status === 'approved' ? 'active' : 'pending',
  }, ...sandboxProjects];
  return redirect('/sandbox');
}

async function benefitLoader(): Promise<BenefitLoaderData> {
  return { interventions: [...interventions] };
}

async function benefitAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const name = String(form.get('name') || '').trim();
  const cost = String(form.get('cost') || '').trim();
  if (!name || !cost) return { error: 'Missing fields' };
  const rec: InterventionRecord = {
    id: `INT-${Date.now()}`,
    intervention_name: name,
    cost_estimate: cost,
    safety_impact: 80,
    economic_impact: 75,
    health_impact: 70,
    equity_impact: 78,
    resilience_impact: 85,
    ai_confidence: 0,
    funding_probability: 0,
    human_authorization_required: true,
    status: 'pending_human_review',
  };
  interventions = [rec, ...interventions];
  return redirect('/benefit');
}

async function mapTwinLoader(): Promise<MapTwinLoaderData> {
  const stage = await fetchLiveStage();
  return {
    site: SITE,
    stage,
    fema: {
      communityNumber: SITE.femaCommunities.mountVernon,
      bfe_ft: SITE.elevations.bfe_ft,
      lag_ft: SITE.elevations.lag_ft,
      clearance_ft: SITE.elevations.clearanceAboveBfe_ft,
      noRiseTolerance_ft: 0.0,
    },
    boundingEnvelope: SITE.boundingEnvelope,
  };
}

function ArchitectureView() {
  const data = useLoaderData() as ArchitectureLoaderData;
  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ color: '#f8fafc' }}>Eight Trust Planes</h1>
      <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{data.coreFlow.join(' → ')}</p>
      {data.trustPlanes.map((p) => (
        <div key={p.level} style={{ background: '#1e293b', borderRadius: 12, padding: '1rem', marginBottom: 8 }}>
          <strong style={{ color: '#38bdf8' }}>L{p.level}</strong>{' '}
          <span style={{ color: '#f8fafc' }}>{p.name}</span>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0.35rem 0 0' }}>{p.description}</p>
        </div>
      ))}
    </div>
  );
}

function MapTwinView() {
  const data = useLoaderData() as MapTwinLoaderData;
  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ color: '#f8fafc' }}>Digital Twin — {data.site.address}</h1>
      <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
        {data.site.township}, {data.site.county} · APN {data.site.apn} · EPSG:{data.site.crs.horizontalEpsg} / {data.site.crs.verticalDatum}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, margin: '1.25rem 0' }}>
        <Card label="BFE" value={`${data.fema.bfe_ft} ft`} />
        <Card label="LAG" value={`${data.fema.lag_ft} ft`} />
        <Card label="Clearance" value={`+${data.fema.clearance_ft} ft`} />
        <Card label="FFE" value={`${data.site.elevations.ffe_ft} ft`} />
        <Card label="Berm Crest" value={`${data.site.elevations.bermCrest_ft} ft`} />
      </div>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '1rem' }}>
        <h3 style={{ color: '#38bdf8', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Live Stage</h3>
        <p style={{ color: '#e2e8f0', margin: 0 }}>
          {data.stage.source} {data.stage.gaugeId}:{' '}
          <strong>{data.stage.value_ft != null ? `${data.stage.value_ft} ft` : 'unavailable'}</strong>
          {' · '}
          <span style={{ color: '#94a3b8' }}>{data.stage.floodCategory}</span>
        </p>
        {data.stage.timestamp && (
          <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.35rem 0 0' }}>{data.stage.timestamp}</p>
        )}
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#475569' }}>
        FEMA community {data.fema.communityNumber} · No-Rise tolerance {data.fema.noRiseTolerance_ft} ft · Human authority required for all LOMA/LOMR actions
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.85rem' }}>
      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{value}</div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: '2rem', color: '#94a3b8' }}>
      <h1 style={{ color: '#f8fafc' }}>{title}</h1>
      <p>View under construction.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    id: 'root',
    path: '/',
    loader: rootLoader,
    element: <RootLayout />,
    children: [
      { index: true, loader: charterLoader, element: <CharterView /> },
      { path: 'architecture', loader: architectureLoader, element: <ArchitectureView /> },
      { path: 'needs', loader: needsLoader, element: <NeedsView /> },
      { path: 'ledger', loader: ledgerLoader, action: ledgerAction, element: <LedgerView /> },
      { path: 'lineage', loader: lineageLoader, action: lineageAction, element: <LineageView /> },
      { path: 'sandbox', loader: sandboxLoader, action: sandboxAction, element: <SandboxView /> },
      { path: 'benefit', loader: benefitLoader, action: benefitAction, element: <BenefitView /> },
      {
        path: 'map',
        loader: mapTwinLoader,
        lazy: async () => ({
          Component: (await import('../routes/MapLibreMap')).default,
        }),
      },
      {
        path: 'eoc',
        loader: mapTwinLoader,
        lazy: async () => ({
          Component: (await import('../routes/MapLibreEocView')).default,
        }),
      },
      {
        path: 'twin',
        loader: mapTwinLoader,
        lazy: async () => ({
          Component: (await import('../routes/TwinCanvasView')).default,
        }),
      },
      { path: 'digital-twin', loader: mapTwinLoader, element: <MapTwinView /> },
      { path: 'placeholder', element: <Placeholder title="Tri-State Systems Manager" /> },
    ],
  },
]);
