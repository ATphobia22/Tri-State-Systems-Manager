/**
 * Crop and watershed model registration and evidence-gated execution planning.
 * No imported engine is considered installed or scientifically validated.
 */
import { createHash } from "node:crypto";
import { HorizontalDatum } from "../../geo/src/geodesy/HorizontalDatum.js";
import { getEpsgCrs } from "../../geo/src/geodesy/EpsgRegistry.js";
import { validateCoordinateReference } from "../../geo/src/geodesy/CrsValidator.js";
import type { CoordinateReference } from "../../geo/src/geodesy/CoordinateReference.js";

const DIGEST=/^[a-f0-9]{64}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export interface AgriculturalSpatialContext {
  readonly epsg: number;
  readonly horizontalDatum: HorizontalDatum;
  readonly coordinateEpoch?: string;
  readonly horizontalUnits: "degree"|"m"|"ftUS";
  readonly vertical:
    | { readonly kind: "NOT_APPLICABLE"; readonly reason: string }
    | { readonly kind: "ABSOLUTE_ELEVATION"; readonly reference: CoordinateReference; readonly units:"m"|"ft"|"ftUS" };
}
export function validateAgriculturalSpatialContext(context: AgriculturalSpatialContext): readonly string[] {
  const errors:string[]=[];
  if (!context || typeof context!=="object") return ["AGRICULTURAL_SPATIAL_CONTEXT_REQUIRED"];
  const crs=getEpsgCrs(context.epsg);
  if (!crs) errors.push("AGRICULTURAL_EPSG_UNSUPPORTED");
  else {
    if (crs.horizontalDatum!==context.horizontalDatum) errors.push("AGRICULTURAL_HORIZONTAL_DATUM_MISMATCH");
    if (crs.suitability==="DISPLAY_ONLY") errors.push("AGRICULTURAL_CRS_IS_DISPLAY_ONLY");
    if ((crs.kind.startsWith("GEOGRAPHIC") && context.horizontalUnits!=="degree") ||
        (context.epsg===2966 && context.horizontalUnits!=="ftUS") ||
        (crs.kind==="PROJECTED" && context.epsg!==2966 && context.horizontalUnits!=="m")) {
      errors.push("AGRICULTURAL_CRS_UNIT_MISMATCH");
    }
  }
  if (context.horizontalDatum===HorizontalDatum.NAD83_2011 &&
      (!context.coordinateEpoch || !Number.isFinite(Number(context.coordinateEpoch)))) errors.push("AGRICULTURAL_COORDINATE_EPOCH_REQUIRED");
  if (!context.vertical || !["NOT_APPLICABLE","ABSOLUTE_ELEVATION"].includes(context.vertical.kind)) errors.push("AGRICULTURAL_VERTICAL_SEMANTICS_REQUIRED");
  else if (context.vertical.kind==="NOT_APPLICABLE" && !context.vertical.reason?.trim()) errors.push("AGRICULTURAL_NON_ELEVATION_REASON_REQUIRED");
  else if (context.vertical.kind==="ABSOLUTE_ELEVATION") {
    if (!["m","ft","ftUS"].includes(context.vertical.units)) errors.push("AGRICULTURAL_ELEVATION_UNITS_INVALID");
    const res=validateCoordinateReference(context.vertical.reference);
    errors.push(...res.errors);
    if (context.vertical.reference?.epsg!==context.epsg ||
        context.vertical.reference?.horizontalDatum!==context.horizontalDatum) errors.push("AGRICULTURAL_ELEVATION_CRS_MISMATCH");
  }
  return [...new Set(errors)];
}
export interface DailyAgriculturalWeather {
  readonly day: string; // Gregorian UTC date, no time zone inference
  readonly precipitationMm: number;
  readonly minimumTemperatureC: number;
  readonly maximumTemperatureC: number;
  readonly referenceEtMm?: number;
}
function dateMilliseconds(day:string):number {
  if (!DATE.test(day)) throw new Error("AGRICULTURAL_DATE_FORMAT_INVALID");
  const timestamp=Date.parse(day+"T00:00:00Z");
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,10)!==day) throw new Error("AGRICULTURAL_DATE_INVALID");
  return timestamp;
}
export function validateDailyAgriculturalWeather(weather: readonly DailyAgriculturalWeather[]):readonly string[] {
  const errors:string[]=[];
  if (!Array.isArray(weather) || !weather.length) return ["AGRICULTURAL_WEATHER_EMPTY"];
  let prev:number|undefined;
  for (const day of weather) {
    if (!day || typeof day!=="object") {errors.push("AGRICULTURAL_WEATHER_ROW_INVALID");continue;}
    try {
      const current=dateMilliseconds(day.day);
      if (prev!==undefined && current-prev!==86400000) errors.push("AGRICULTURAL_WEATHER_DATE_GAP_OR_ORDER");
      prev=current;
    } catch {errors.push("AGRICULTURAL_WEATHER_DATE_INVALID");}
    if (![day.precipitationMm,day.minimumTemperatureC,day.maximumTemperatureC].every(Number.isFinite) ||
      (day.referenceEtMm!==undefined && !Number.isFinite(day.referenceEtMm))) errors.push("AGRICULTURAL_WEATHER_NONFINITE");
    if (day.precipitationMm<0 || (day.referenceEtMm!==undefined && day.referenceEtMm<0)) errors.push("AGRICULTURAL_WEATHER_NEGATIVE_DEPTH");
    if (day.minimumTemperatureC>day.maximumTemperatureC) errors.push("AGRICULTURAL_WEATHER_TEMPERATURE_ORDER");
  }
  return [...new Set(errors)];
}
export interface AgriculturalEngine {
  readonly id: string;readonly repo:string;readonly license:string;
  readonly role:"SOURCE_ADAPTER"|"PROCESSOR"|"CROP_MODEL"|"WATERSHED_MODEL"|"LAND_SURFACE_MODEL";
  readonly adoption:"P0"|"P1"|"P2";
  readonly distribution:"PERMISSIVE"|"COPYLEFT_REVIEW"|"RESTRICTED_REVIEW";
}
export const AGRICULTURAL_ENGINE_CATALOG: readonly AgriculturalEngine[] = [
  {id:"swatplus",repo:"https://github.com/swat-model/swatplus",license:"LGPL-2.1",role:"WATERSHED_MODEL",adoption:"P0",distribution:"COPYLEFT_REVIEW"},
  {id:"aquacrop-ospy",repo:"https://github.com/aquacropos/aquacrop",license:"Apache-2.0",role:"CROP_MODEL",adoption:"P0",distribution:"PERMISSIVE"},
  {id:"soildb",repo:"https://github.com/ncss-tech/soilDB",license:"GPL-3.0",role:"SOURCE_ADAPTER",adoption:"P0",distribution:"COPYLEFT_REVIEW"},
  {id:"pyfao56",repo:"https://github.com/kthorp/pyfao56",license:"CC0-1.0 / US Government work",role:"CROP_MODEL",adoption:"P1",distribution:"PERMISSIVE"},
  {id:"pcse",repo:"https://github.com/ajwdewit/pcse",license:"EUPL-1.1",role:"CROP_MODEL",adoption:"P1",distribution:"COPYLEFT_REVIEW"},
  {id:"dssat-csm-os",repo:"https://github.com/DSSAT/dssat-csm-os",license:"BSD-3-Clause",role:"CROP_MODEL",adoption:"P1",distribution:"PERMISSIVE"},
  {id:"farmos",repo:"https://github.com/farmOS/farmOS",license:"GPL-2.0",role:"SOURCE_ADAPTER",adoption:"P1",distribution:"COPYLEFT_REVIEW"},
  {id:"opendronemap",repo:"https://github.com/OpenDroneMap/ODM",license:"AGPL-3.0",role:"PROCESSOR",adoption:"P1",distribution:"COPYLEFT_REVIEW"},
  {id:"eo-learn",repo:"https://github.com/sentinel-hub/eo-learn",license:"MIT",role:"PROCESSOR",adoption:"P1",distribution:"PERMISSIVE"},
  {id:"nasa-lisf",repo:"https://github.com/NASA-LIS/LISF",license:"Apache-2.0",role:"LAND_SURFACE_MODEL",adoption:"P1",distribution:"PERMISSIVE"},
  {id:"apsim-nextgen",repo:"https://github.com/APSIMInitiative/ApsimX",license:"CUSTOM",role:"CROP_MODEL",adoption:"P2",distribution:"RESTRICTED_REVIEW"},
  {id:"fao-aquacrop-7.3",repo:"https://github.com/un-fao/fao-AquaCrop",license:"ALL RIGHTS RESERVED",role:"CROP_MODEL",adoption:"P2",distribution:"RESTRICTED_REVIEW"}
];
export interface AgriculturalExecutionInput {
  readonly engineId:string;
  /** Exact source-tree or built executable digest, not just a version name. */
  readonly executableSha256:string;
  readonly inputManifestSha256:string;
  readonly configurationSha256:string;
  readonly spatial: AgriculturalSpatialContext;
  readonly firstDay:string;readonly lastDay:string;
}
export interface AgriculturalExecutionPlan extends AgriculturalExecutionInput {
  readonly planSha256:string;
  readonly executionStatus:"NOT_EXECUTED";
  readonly scientificStatus:"HUMAN_REVIEW_REQUIRED";
}
/** Planning never calls third-party model code or upgrades an uncalibrated run. */
export function createAgriculturalExecutionPlan(input:AgriculturalExecutionInput):AgriculturalExecutionPlan {
  const engine=AGRICULTURAL_ENGINE_CATALOG.find(e=>e.id===input.engineId);
  if (!engine) throw new Error("AGRICULTURAL_ENGINE_UNREGISTERED");
  if (engine.distribution==="RESTRICTED_REVIEW") throw new Error("AGRICULTURAL_ENGINE_LICENSE_REVIEW_REQUIRED");
  if (engine.role!=="CROP_MODEL" && engine.role!=="WATERSHED_MODEL" && engine.role!=="LAND_SURFACE_MODEL") throw new Error("AGRICULTURAL_ENGINE_NOT_A_SOLVER");
  for (const hash of [input.executableSha256,input.inputManifestSha256,input.configurationSha256]) {
    if (!DIGEST.test(hash)) throw new Error("AGRICULTURAL_EXECUTION_HASH_REQUIRED");
  }
  const spatialErrors=validateAgriculturalSpatialContext(input.spatial);
  if (spatialErrors.length) throw new Error("AGRICULTURAL_SPATIAL_REJECTED:"+spatialErrors.join(","));
  if (dateMilliseconds(input.firstDay)>dateMilliseconds(input.lastDay)) throw new Error("AGRICULTURAL_EXECUTION_DATE_RANGE_INVALID");
  const canonical={
    engineId:input.engineId,executableSha256:input.executableSha256,
    inputManifestSha256:input.inputManifestSha256,configurationSha256:input.configurationSha256,
    spatial:input.spatial,firstDay:input.firstDay,lastDay:input.lastDay
  };
  return {...canonical,planSha256:createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
    executionStatus:"NOT_EXECUTED",scientificStatus:"HUMAN_REVIEW_REQUIRED"};
}
/** Physical check for a CLOSED single-bucket water balance only. */
export function assessClosedBucketWaterBalance(input:{
  readonly initialStorageMm:number;readonly precipitationMm:number;readonly irrigationMm:number;
  readonly finalStorageMm:number;readonly evapotranspirationMm:number;readonly runoffMm:number;
  readonly deepDrainageMm:number;readonly toleranceMm:number;
}):{readonly valid:boolean;readonly residualMm:number;readonly status:"NUMERICAL_CHECK_PASS"|"NUMERICAL_CHECK_FAIL"} {
  const values=Object.values(input);
  if(values.some(v=>!Number.isFinite(v)||v<0)) throw new Error("AGRICULTURAL_WATER_BALANCE_VALUES_INVALID");
  const residualMm=(input.initialStorageMm+input.precipitationMm+input.irrigationMm)-
    (input.finalStorageMm+input.evapotranspirationMm+input.runoffMm+input.deepDrainageMm);
  const valid=Math.abs(residualMm)<=input.toleranceMm;
  return {valid,residualMm,status:valid?"NUMERICAL_CHECK_PASS":"NUMERICAL_CHECK_FAIL"};
}
