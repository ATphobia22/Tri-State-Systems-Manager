import RiverGaugeBoard from '../components/RiverGaugeBoard';
import EngineeringSectionCutaway, { type EngineeringSectionModel } from '../components/EngineeringSectionCutaway';

const EVIDENCE_AUTHORITY_BOUNDARY = 'MODEL/UI · BACKEND-SEAL REQUIRED';
const EVIDENCE_OBSERVATION_BOUNDARY = 'OBSERVATION BOUND';
const EVIDENCE_BACKEND_SEAL_REQUIRED = 'BACKEND-SEAL REQUIRED';

const COMMUNITY_SECTION: EngineeringSectionModel = {
  sectionId: 'community-section-review-input', verticalDatum: 'NAVD88', horizontalCrs: 'EPSG:2966', reviewState: 'INPUT_INCOMPLETE',
  layers: [
    { id: 'ground', name: 'Existing ground / survey surface', topFt: null, bottomFt: null, materialClass: 'field evidence required', provenanceId: 'SURVEY_REQUIRED', publicExplanation: 'Actual ground elevation must come from controlled survey or an authoritative terrain product.' },
    { id: 'subsurface', name: 'Subsurface investigation', topFt: null, bottomFt: null, materialClass: 'site investigation required', provenanceId: 'GEOTECH_INVESTIGATION_REQUIRED', publicExplanation: 'Borings, CPT, groundwater and laboratory results determine support conditions.' },
    { id: 'foundation', name: 'Foundation preparation / drainage', topFt: null, bottomFt: null, materialClass: 'design dependent', provenanceId: 'ENGINEERING_DESIGN_REQUIRED', publicExplanation: 'Preparation, drainage and reinforcement depend on verified soil and hydraulic conditions.' },
    { id: 'fill', name: 'Qualified engineered fill', topFt: null, bottomFt: null, materialClass: 'qualification required', provenanceId: 'MATERIAL_QUALIFICATION_REQUIRED', publicExplanation: 'Dredged or imported material cannot be assumed suitable for structural fill.' },
    { id: 'finished', name: 'Finished road / berm grade', topFt: null, bottomFt: null, materialClass: 'design surface pending', provenanceId: 'PROJECT_GEOMETRY_REQUIRED', publicExplanation: 'Finished elevation, freeboard, drainage and erosion protection require project-specific design.' },
  ],
  missingEvidence: ['controlled survey', 'site-specific geotechnical investigation', 'groundwater/pore-pressure evidence', 'qualified fill laboratory results', 'hydraulic boundary conditions', 'approved project geometry'],
};

export default function CinematicHudView(): JSX.Element {
  return <main style={{ minHeight: '100%', background: '#020617', color: '#e2e8f0', padding: 20, display: 'grid', gap: 18 }}>
    <header style={{ border: '1px solid #334155', borderRadius: 16, padding: 18, background: '#07111c' }}>
      <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Tri-State River Valley Engineering Console</h1>
      <p style={{ marginBottom: 0, color: '#cbd5e1' }}>Community-scale evidence, river observations and engineering review. Observations, forecasts, models and simulations remain explicitly separated.</p>
      <p aria-label="Evidence authority boundary" style={{ marginBottom: 0 }}>{EVIDENCE_AUTHORITY_BOUNDARY}</p>
      <p aria-label="Observation boundary" style={{ marginBottom: 0 }}>{EVIDENCE_OBSERVATION_BOUNDARY}</p>
      <p aria-label="Backend evidence seal status" style={{ marginBottom: 0 }}>{EVIDENCE_BACKEND_SEAL_REQUIRED}</p>
    </header>
    <RiverGaugeBoard />
    <EngineeringSectionCutaway model={COMMUNITY_SECTION} />
  </main>;
}
