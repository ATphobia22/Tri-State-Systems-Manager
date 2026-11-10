/**
 * Pure screening contracts. A GIS footprint or a matching GERS ID is not a
 * certified survey; no result here establishes legally compliant construction.
 */
const FINITE_POSITIVE = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const VALID_EVIDENCE = new Set(['LIDAR_QA_REVIEWED', 'FIELD_SURVEY_REVIEWED']);
export function screenBuildingHeight({heightFt, heightEvidence='PENDING', maxHeightFt, ordinanceVersion, verticalReceiptSha256}) {
  if (!VALID_EVIDENCE.has(heightEvidence) ||
      !FINITE_POSITIVE(heightFt) ||
      !FINITE_POSITIVE(maxHeightFt) ||
      typeof ordinanceVersion !== 'string' || !ordinanceVersion.trim() ||
      typeof verticalReceiptSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(verticalReceiptSha256)) {
    return Object.freeze({status:'PENDING_EVIDENCE', regulatoryStatus:'NOT_A_REGULATORY_DETERMINATION'});
  }
  return Object.freeze({
    status: heightFt > maxHeightFt ? 'SCREENING_CONFLICT' : 'SCREENING_PASS',
    regulatoryStatus: 'NOT_A_REGULATORY_DETERMINATION',
    measuredFt: heightFt,
    boundFt: maxHeightFt
  });
}
/** Diagnostic ONLY: projected point/polygon units in EPSG:2966 are US survey feet. */
export function screenParcelBoundaryProximity({distanceUsft, crs}) {
  if (crs !== 'EPSG:2966' || typeof distanceUsft !== 'number' || !Number.isFinite(distanceUsft) || distanceUsft < 0) {
    return {status: 'PENDING_EVIDENCE', setbackStatus: 'FRONT_SIDE_REAR_SETBACK_NOT_EVALUATED'};
  }
  return {status: 'DIAGNOSTIC_ONLY', nearestBoundaryUsft: distanceUsft,
    setbackStatus: 'FRONT_SIDE_REAR_SETBACK_NOT_EVALUATED'};
}
/** Only an explicit source and vertical provenance can promote a LiDAR field. */
export function mapBuildingVerticalAttributes(properties, source) {
  const p = properties && typeof properties === 'object' ? properties : {};
  const s = source && typeof source === 'object' ? source : {};
  const roof = p.Roof_Elev, ground = p.Ground_Elev;
  const trusted = s.qaReviewed === true && s.verticalDatum === 'NAVD88' &&
    s.verticalUnits === 'US_SURVEY_FOOT' && s.horizontalCrs &&
    typeof s.sha256 === 'string' && /^[0-9a-f]{64}$/.test(s.sha256) &&
    typeof roof === 'number' && Number.isFinite(roof) &&
    typeof ground === 'number' && Number.isFinite(ground) && roof > ground;
  return trusted
    ? {heightEvidence:'LIDAR_QA_REVIEWED', heightFt:roof-ground, roofElevationNavd88Ft:roof,
       groundElevationNavd88Ft:ground, evidenceSha256:s.sha256}
    : {heightEvidence:'PENDING', heightFt:null, roofElevationNavd88Ft:null,
       groundElevationNavd88Ft:null, evidenceSha256:null};
}
