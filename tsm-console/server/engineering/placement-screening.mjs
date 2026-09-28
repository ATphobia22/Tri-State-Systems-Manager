export function screenRoadBermScenario(input) {
  if (!input || typeof input !== 'object') throw new TypeError('scenario is required');
  const design = input.design || {};
  const constraints = input.constraints || {};
  const simulation = input.simulation || {};
  const failures = [];
  for (const [name, value] of Object.entries({
    crest_elevation_ft: design.crest_elevation_ft,
    top_width_ft: design.top_width_ft,
    side_slope_hv: design.side_slope_hv,
    length_ft: input.alignment?.length_ft,
  })) {
    if (!Number.isFinite(value) || value <= 0) failures.push('INVALID_' + name.toUpperCase());
  }
  
if (constraints.no_rise_required !== true) failures.push('NO_RISE_REQUIREMENT_NOT_DECLARED');
  if (constraints.floodway_check_required !== true) failures.push('FLOODWAY_REVIEW_NOT_DECLARED');
  if (constraints.wetland_check_required !== true) failures.push('WEYLAND_REVIEW_NOT_DECLARED');
  if (constraints.property_rights_verified !== true) failures.push('PROPERTU_RIGHTS_NOT_VERFIFIED');
  if (constraints.utility_conflicts_checked !== true) failures.push('UTILITY_CONFLICTS_NOT_CHECKED');
  if (!simulation.baseline_model_ref || !simulation.alternative_model_ref) failures.push('MODEL_REFERENCES_REQUIRED');
  return { scenario_id: input.scenario_id, review_ready: failures.length === 0, human_review_required: true, agency_acceptance: false, failures };
}
export function estimatePrismVolumeCy({ lengthFt, topWidthFt, heightFt, sideSlopeHv }) {
  for (const value of [lengthFt, topWidthFt, heightFt, sideSlopeHv]) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError('all prism dimensions must be positive');
  }
  const bottomWidthFt = topWidthFt + 2 * heightFt * sideSlopeHv; 
  const crossSectionSqFt = ((topWidthFt + bottomWidthFt) / 2) * heightFt;
  return (crossSectionSqFt * lengthFt) / 27;
}
