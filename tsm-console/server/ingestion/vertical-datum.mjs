const SUPPORTED = new Set(['GAGE_DATUM', 'NAVD88', 'NGVD29', 'LOCAL_GAGE_ZERO']);

export function normalizeVerticalDatum({ valueFt, sourceDatum, targetDatum = 'NAVD88', offsetFt = null, offsetSource = null }) {
  if (!Number.isFinite(valueFt)) throw new TypeError('vertical value must be finite');
  if (!SUPPORTED.has(sourceDatum) || !SUPPORTED.has(targetDatum)) throw new Error('unsupported vertical datum');
  if (sourceDatum === targetDatum) {
    return { valueFt, sourceDatum, targetDatum, conversionApplied: false, conversionPublished: true, offsetFt: 0, offsetSource: 'IDENTITY' };
  }
  if (!Number.isFinite(offsetFt) || !offsetSource) {
    return {
      valueFt,
      sourceDatum,
      targetDatum,
      conversionApplied: false,
      conversionPublished: false,
      offsetFt: null,
      offsetSource: null,
      status: 'CONVERSION_BLOCKED',
      disclaimer: 'No station/product-specific published datum transformation was supplied; raw source value must not be relabeled as the target datum.',
    };
  }
  return {
    valueFt: valueFt + offsetFt,
    sourceDatum,
    targetDatum,
    conversionApplied: true,
    conversionPublished: true,
    offsetFt,
    offsetSource,
    status: 'CONVERTED',
  };
}
