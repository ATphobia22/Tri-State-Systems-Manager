const SUPPORTED = new Set(['GAGE_DATUM', 'NAVD88', 'NGVD29', 'LOCAL_GAGE_ZERO']);

export function normalizeVerticalDatum({ valueFt, sourceDatum, targetDatum = 'NAVD88', offsetFt = null, offsetSource = null }) {
  if (!Number.isFinite(valueFt)) throw new TypeError('vertical value must be finite');
  if (!SUPPORTED.has(sourceDatum) || !SUPPORTED.has(targetDatum)) throw new Error('unsupported vertical datum');
  if (sourceDatum === targetDatum) {
    return { valueFt, sourceDatum, targetDatum, conversionApplied: false, conversionPublished: true, offsetFt: 0, offsetSource: 'IDENTITY', status: 'VERIFIED_IDENTITY' };
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
      status: 'UNVERIFIED_CONVERSION',
      provisional: true,
      disclaimer: 'Source value is retained in its native datum. No target-datum value is asserted without a published station/product-specific transformation.',
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
    status: 'VERIFIED_CONVERSION',
    provisional: false,
  };
}
