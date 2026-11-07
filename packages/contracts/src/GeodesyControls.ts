/** Evidence prerequisites; declarations do not validate an actual conversion. */
export interface GeodesyControls {
  readonly requireGeoidForOrthometric: true;
  readonly requireGageDatumForStageToElevation: true;
}
export const GEODESY_CONTROLS: GeodesyControls = {
  requireGeoidForOrthometric: true,
  requireGageDatumForStageToElevation: true,
};
