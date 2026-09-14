import EngineeringSectionCutaway, { type EngineeringSectionModel } from '../components/EngineeringSectionCutaway';

const COMMUNITY_SECTION: EngineeringSectionModel = {
  sectionId: 'community-section-review-input',
  verticalDatum: 'NAVD88',
  horizontalCrs: 'EPSG:2966',
  reviewState: 'INPUT_INCOMPLETE',
  layers: [
    { id: 'ground', name: 'Existing ground / survey surface', topFt: null, bottomFt: null, materialClass: 'field evidence required', provenanceId: 'SURVEY_REQUIRED', publicExplanation: 'Actual ground elevation must come from controlled survey or an authoritative terrain product.' },
    { id: 'subsurface', name: 'Subsurface investigation', topFt: null, bottomFt: null, materialClass: 'site investigation required', provenanceId: 'GEOTECH_INVESTIGATION_REQUIRED', publicExplanation: 'Borings, CPT, groundwater and laboratory results determine support conditions.' },
    { id: 'foundation', name: 'Foundation preparation / drainage', topFt: null, bottomFt: null, materialClass: 'design dependent', provenanceId: 'ENGINEERING_DESIGN_REQUIRED', publicExplanation: 'Preparation, drainage and reinforcement depend on verified soil and hydraulic conditions.' },
    { id: 'fill', name: 'Qualified engineered fill', topFt: null, bottomFt: null, materialClass: 'qualification required', provenanceId: 'MATERIAL_QUALIFICATION_REQUIRED', publicExplanation: 'Dredged or imported material cannot be assumed suitable for structural fill.' },
    { id: 'finished', name: 'Finished road / berm grade', topFt: null, bottomFt: null, materialClass: 'design surface pending', provenanceId: 'PROJECT_GEOMETRY_REQUIRED', publicExplanation: 'Finished elevation, freeboard, drainage and erosion protection require project-specific design.' },
  ],
  missingEvidence: ['controlled survey', 'site-specific geotechnical investigation', 'groundwater/pore-pressure evidence', 'qualified fill laboratory results', 'hydraulic boundary conditions', 'approved project geometry'],
};

export default function EngineeringSectionView(): JSX.Element {
  return (
    <main style={{ minHeight: '100%', padding: 20, background: '#020617', color: '#e2e8f0' }}>
      <header style={{ maxWidth: 1200, margin: '0 auto 18px' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Subsurface-to-Finished-Grade Engineering</h1>
        <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>A transparent engineering section for review. Blank values are deliberate: the system does not invent survey, geotechnical, material, hydraulic or design evidence.</p>
      </header>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}><EngineeringSectionCutaway model={COMMUNITY_SECTION} /></div>
    </main>
  );
}
