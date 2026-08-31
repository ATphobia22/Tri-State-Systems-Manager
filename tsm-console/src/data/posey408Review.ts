export type ReviewDisposition = 'authoritative_pending_agency' | 'project_assertion' | 'requires_engineering_verification' | 'requires_agency_confirmation' | 'draft_only';

export interface Posey408ReviewItem {
  id: string;
  claim: string;
  disposition: ReviewDisposition;
  requiredEvidence: string[];
}

export const POSEY_408_REVIEW: readonly Posey408ReviewItem[] = [
  { id: 'bfe-375', claim: 'BFE 375.00 ft NAVD88 for the proposed site', disposition: 'requires_agency_confirmation', requiredEvidence: ['effective FEMA FIRM/FIS record', 'panel effective date', 'survey datum/control tie'] },
  { id: 'lag-37720', claim: 'LAG 377.20 ft NAVD88', disposition: 'requires_engineering_verification', requiredEvidence: ['raw LiDAR/point-cloud evidence', 'survey control', 'foundation perimeter', 'vertical accuracy report'] },
  { id: 'berm-5000', claim: 'Approximately 5,000 cubic yards of berm fill', disposition: 'project_assertion', requiredEvidence: ['signed civil plans', 'existing/proposed surfaces', 'earthwork volume calculation'] },
  { id: 'basin-6500', claim: 'Approximately 6,500 cubic yards of compensatory excavation', disposition: 'project_assertion', requiredEvidence: ['signed grading plans', 'existing/proposed surfaces', 'stage-storage calculation'] },
  { id: 'zero-rise', claim: '0.000 ft post-intervention backwater surcharge', disposition: 'requires_engineering_verification', requiredEvidence: ['HEC-RAS project files', 'terrain geometry', 'boundary conditions', 'calibration/validation results', 'independent review'] },
  { id: 'fos-168', claim: 'Minimum slope-stability factor of safety 1.68', disposition: 'requires_engineering_verification', requiredEvidence: ['geotechnical report', 'soil parameters', 'cross-sections', 'load cases', 'signed calculations'] },
  { id: 'wotus', claim: 'Proposed footprint is outside jurisdictional WOTUS', disposition: 'requires_agency_confirmation', requiredEvidence: ['wetland/waters delineation', 'USACE AJD or applicable determination'] },
  { id: 'esa', claim: 'No adverse effect to listed species/critical habitat', disposition: 'requires_agency_confirmation', requiredEvidence: ['IPaC official species list', 'effects analysis', 'agency consultation where required'] },
  { id: 'section106', claim: 'No historic/cultural resources affected', disposition: 'requires_agency_confirmation', requiredEvidence: ['SHPO/DHPA consultation record', 'cultural-resource survey where required'] },
  { id: 'section204', claim: 'Clean dredged material available at $0 procurement cost', disposition: 'requires_agency_confirmation', requiredEvidence: ['USACE source project', 'material characterization', 'beneficial-use authorization', 'transport/logistics estimate'] },
];
