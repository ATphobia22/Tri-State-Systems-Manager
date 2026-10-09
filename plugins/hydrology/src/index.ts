/** Hydrology plugin — re-exports gates + geo site frame for local offline use. */
export {
  convertGageHeightToNavd88,
  evaluateLomaLagVsBfe,
  requireHumanAuthoritySeal,
  evaluateEngineeringGate,
} from '../../../packages/gates/src/index.ts';
export { BONEBANK_SITE, CRS_HORIZONTAL_EPSG, VERTICAL_DATUM, GAGE_SITES } from '../../../packages/geo/src/index.ts';
export { classifyHydraulicAuthority, SIMULATION_DEMO_LABEL } from '../../../packages/hydraulics/src/index.ts';
