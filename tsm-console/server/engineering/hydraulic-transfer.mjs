/**
 * Evidence-gated hydraulic transfer for PTDT.
 * FEMA/FIS reach coefficients are never embedded here without a validated
 * evidence artifact.
 */
const CM_DEFAULT = 1.486;

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite`);
  return number;
}
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function requireValidatedProfile(profile) {
  if (!profile || profile.validation_status !== 'validated') {
    throw Object.assign(new Error('HYDRAULIC_PROFILE_NOT_VALIDATED'), { code: 'HYDRAULIC_PROFILE_NOT_VALIDATED', status: 422 });
  }
  if (!profile.evidence_artifact_id || !profile.source_uri) {
    throw Object.assign(new Error('HYDRAULIC_PROFILE_PROVENANCE_REQUIRED'), { code: 'HYDRAULIC_PROFILE_PROVENANCE_REQUIRED', status: 422 });
  }
}

export function calculateManningFrictionSlope({ roughness, dischargeCfs, areaFt2, hydraulicRadiusFt, manningConstant = CM_DEFAULT }) {
  const n = finite(roughness, 'roughness');
  const q = finite(dischargeCfs, 'dischargeCfs');
  const area = finite(areaFt2, 'areaFt2');
  const radius = finite(hydraulicRadiusFt, 'hydraulicRadiusFt');
  const cm = finite(manningConstant, 'manningConstant');
  if (n <= 0 || area <= 0 || radius <= 0 || cm <= 0) throw new RangeError('Manning inputs must be positive');
  const slope = (n * Math.abs(q) / (cm * area * Math.pow(radius, 2 / 3))) ** 2;
  if (!Number.isFinite(slope) || slope < 0) throw new RangeError('Manning friction slope diverged');
  return slope;
}

export function calculateBackwaterAlpha({ distanceDownstreamFt, reachLengthFt, backwaterLengthFt, beta, wseOhioNavd88Ft, wseOpenChannelNavd88Ft, invertNavd88Ft }) {
  const x = finite(distanceDownstreamFt, 'distanceDownstreamFt');
  const reach = finite(reachLengthFt, 'reachLengthFt');
  const length = finite(backwaterLengthFt, 'backwaterLengthFt');
  const decay = finite(beta, 'beta');
  const ohio = finite(wseOhioNavd88Ft, 'wseOhioNavd88Ft');
  const open = finite(wseOpenChannelNavd88Ft, 'wseOpenChannelNavd88Ft');
  const invert = finite(invertNavd88Ft, 'invertNavd88Ft');
  if (x < 0 || reach <= 0 || length <= 0 || decay < 0) throw new RangeError('Backwater calibration geometry is invalid');
  if (ohio <= open) return 0;
  const relativePosition = (reach - x) / length;
  const exponential = Math.exp(-decay * relativePosition);
  const denominator = open - invert;
  if (denominator <= 0) return 0;
  const alpha = exponential * clamp((ohio - invert) / denominator, 0, 1);
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw Object.assign(new Error('HYDRAULIC_BACKWATER_ALPHA_INVALID'), { code: 'HYDRAULIC_BACKWATER_ALPHA_INVALID', status: 422 });
  }
  return alpha;
}

export function calculateLocalProfileWSE({ stationWseNavd88Ft, ohioWseNavd88Ft, distanceDownstreamFt, dischargeCfs, invertNavd88Ft, profile, segments }) {
  requireValidatedProfile(profile);
  const station = finite(stationWseNavd88Ft, 'stationWseNavd88Ft');
  const ohio = finite(ohioWseNavd88Ft, 'ohioWseNavd88Ft');
  const targetX = finite(distanceDownstreamFt, 'distanceDownstreamFt');
  const q = finite(dischargeCfs, 'dischargeCfs');
  if (!Array.isArray(segments) || segments.length === 0) throw Object.assign(new Error('HYDRAULIC_SEGMENTS_REQUIRED'), { code: 'HYDRAULIC_SEGMENTS_REQUIRED', status: 422 });

  let wse = station;
  let previousX = 0;
  for (const segment of segments) {
    const x = finite(segment.distanceDownstreamFt, 'segment.distanceDownstreamFt');
    if (x <= previousX || x > targetX) continue;
    const area = finite(segment.areaFt2, 'segment.areaFt2');
    const wettedPerimeter = finite(segment.wettedPerimeterFt, 'segment.wettedPerimeterFt');
    if (wettedPerimeter <= 0) throw new RangeError('wetted perimeter must be positive');
    const radius = area / wettedPerimeter;
    const slope = calculateManningFrictionSlope({
      roughness: finite(segment.manningN, 'segment.manningN'),
      dischargeCfs: q,
      areaFt2: area,
      hydraulicRadiusFt: radius,
      manningConstant: profile.manning_constant ?? CM_DEFAULT,
    });
    wse -= slope * (x - previousX);
    if (!Number.isFinite(wse)) throw Object.assign(new Error('HYDRAULIC_SOLVER_DIVERGED'), { code: 'HYDRAULIC_SOLVER_DIVERGED', status: 422 });
    previousX = x;
  }

  const alpha = calculateBackwaterAlpha({
    distanceDownstreamFt: targetX,
    reachLengthFt: profile.reach_length_ft,
    backwaterLengthFt: profile.backwater_length_ft,
    beta: profile.beta,
    wseOhioNavd88Ft: ohio,
    wseOpenChannelNavd88Ft: wse,
    invertNavd88Ft,
  });
  const finalWse = (1 - alpha) * wse + alpha * ohio;
  if (!Number.isFinite(finalWse)) throw Object.assign(new Error('HYDRAULIC_SOLVER_DIVERGED'), { code: 'HYDRAULIC_SOLVER_DIVERGED', status: 422 });
  return {
    wse_navd88_ft: Number(finalWse.toFixed(2)),
    open_channel_wse_navd88_ft: Number(wse.toFixed(2)),
    backwater_alpha: Number(alpha.toFixed(6)),
    state: 'VERIFIED_ENGINEERING_MODEL_OUTPUT',
    governance_status: 'human_review_required',
    is_simulation_demo: false,
    evidence_artifact_id: profile.evidence_artifact_id,
    source_uri: profile.source_uri,
  };
}
