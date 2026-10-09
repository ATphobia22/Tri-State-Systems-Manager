import { useState } from 'react';
import TriStateDigitalTwinMap, { defaultMapPlaneVisibility } from '../components/TriStateDigitalTwinMap';
import CinematicTwinHud, {
  type TwinLayerId,
  type EngineeringMode,
} from '../components/CinematicTwinHud';
import type { EngineeringSectionModel } from '../components/EngineeringSectionCutaway';

/**
 * /cinematic — the cinematic 3D twin experience.
 *
 * Full-screen MapLibre plane (terrain mesh, building extrusions, roads,
 * imagery, quad index) driven by the CinematicTwinHud overlay. The HUD's
 * layer chips toggle the real map layers; the cutaway opens the
 * evidence-bound EngineeringSectionCutaway.
 */

/** HUD layer id -> map-plane fabric id. */
const HUD_TO_FABRIC: Record<TwinLayerId, string> = {
  'fema-bfe': 'fema-nfhl',
  buildings: 'indiana-buildings',
  roads: 'indiana-roads',
  'quad-index': 'usgs-quad-index',
  imagery: 'indiana-imagery',
};

/**
 * Site cross-section bound to the FEMA case record (case 26-05-2022A).
 * Elevations are case-record values, NOT survey observations — the model
 * stays INPUT_INCOMPLETE until field evidence is sealed.
 */
const SITE_CUTAWAY: EngineeringSectionModel = {
  sectionId: 'bonebank-road-site-section',
  verticalDatum: 'NAVD88',
  horizontalCrs: 'EPSG:2966',
  reviewState: 'INPUT_INCOMPLETE',
  layers: [
    { id: 'bfe', name: 'FEMA Base Flood Elevation', topFt: 375.0, bottomFt: 375.0, materialClass: 'regulatory water-surface elevation', provenanceId: 'FEMA-CASE-26-05-2022A', publicExplanation: 'BFE 375.0 ft NAVD88 from the FEMA case record. Regulatory water surface, not a surveyed ground elevation.' },
    { id: 'lag', name: 'Lowest Adjacent Grade (case record)', topFt: 377.2, bottomFt: 377.2, materialClass: 'case-record grade', provenanceId: 'FEMA-CASE-26-05-2022A', publicExplanation: 'LAG 377.2 ft NAVD88 from the case record. Field survey required to confirm.' },
    { id: 'berm', name: 'Berm crest (case record)', topFt: 379.8, bottomFt: 379.8, materialClass: 'case-record crest', provenanceId: 'FEMA-CASE-26-05-2022A', publicExplanation: 'Berm crest 379.8 ft from the case record. As-built survey required.' },
    { id: 'ffe', name: 'Finished Floor Elevation (case record)', topFt: 382.5, bottomFt: 382.5, materialClass: 'case-record finished floor', provenanceId: 'FEMA-CASE-26-05-2022A', publicExplanation: 'FFE 382.5 ft from the case record.' },
    { id: 'subsurface', name: 'Subsurface investigation', topFt: null, bottomFt: null, materialClass: 'site investigation required', provenanceId: 'GEOTECH_INVESTIGATION_REQUIRED', publicExplanation: 'Borings, CPT, groundwater and laboratory results determine support conditions.' },
  ],
  missingEvidence: ['controlled survey of LAG/FFE/berm crest', 'site-specific geotechnical investigation', 'as-built berm geometry'],
};

export default function CinematicView(): JSX.Element {
  const [visible, setVisible] = useState<Record<string, boolean>>(defaultMapPlaneVisibility);
  const [engineeringMode, setEngineeringMode] = useState<EngineeringMode>('NAVIGATION');
  const [lightPreset, setLightPreset] = useState<'day' | 'golden' | 'night'>('day');

  const hudLayers = (Object.keys(HUD_TO_FABRIC) as TwinLayerId[]).reduce(
    (acc, id) => ({ ...acc, [id]: Boolean(visible[HUD_TO_FABRIC[id]]) }),
    {} as Record<TwinLayerId, boolean>,
  );

  const toggleHudLayer = (id: TwinLayerId): void => {
    const fabricId = HUD_TO_FABRIC[id];
    setVisible((current) => ({ ...current, [fabricId]: !current[fabricId] }));
  };

  return (
    <main style={{ position: 'relative', height: '100dvh', background: '#05080f' }}>
      <TriStateDigitalTwinMap
        hideSidebar
        visible={visible}
        onVisibleChange={setVisible}
        lightPreset={lightPreset}
      />
      <CinematicTwinHud
        layers={hudLayers}
        onToggleLayer={toggleHudLayer}
        engineeringMode={engineeringMode}
        onEngineeringModeChange={setEngineeringMode}
        lightPreset={lightPreset}
        onLightPresetChange={setLightPreset}
        cutawayModel={SITE_CUTAWAY}
      />
      {engineeringMode !== 'NAVIGATION' && (
        <div role="status" style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 20, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(251,191,36,.5)', background: 'rgba(5,8,15,.92)', fontSize: 12, color: '#fbbf24' }}>
          {engineeringMode === 'BERM_PLACEMENT'
            ? 'Berm placement mode — placement tools live in /flood-sim; this view is navigation + visualization.'
            : 'Road construction mode — road placement tools live in /flood-sim; this view is navigation + visualization.'}
        </div>
      )}
    </main>
  );
}
