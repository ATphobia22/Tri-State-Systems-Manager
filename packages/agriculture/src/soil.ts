/**
 * Evidence-first USDA Soil Data Access (SDA) tabular import.
 *
 * This consumes already-acquired, byte-verified JSON snapshots. It does not
 * fetch data, assume a soil is site-surveyed, or invent missing horizons.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { assertPromotableSnapshot, type GovernmentSnapshotManifest } from "../../government/src/ingestion.js";

export interface SoilHorizon {
  readonly horizonKey: string;
  readonly topCm: number;
  readonly bottomCm: number;
  readonly sandPercent: number;
  readonly siltPercent: number;
  readonly clayPercent: number;
  readonly availableWaterCapacityCmPerCm?: number;
}
export interface SoilProfile {
  readonly mapUnitKey: string;
  readonly componentKey: string;
  readonly horizons: readonly SoilHorizon[];
  /** Depth below local soil surface is NOT a NAVD88 elevation. */
  readonly verticalReference: "NOT_APPLICABLE";
  readonly sourceDatasetId: "usda.ssurgo";
  readonly sourceSha256: string;
}
export interface SoilImport {
  readonly profiles: readonly SoilProfile[];
  readonly sourceSha256: string;
  readonly derivedSha256: string;
  readonly datasetVersion: string;
  readonly importedAt: string;
  readonly status: "DERIVED_UNCALIBRATED";
}
const SHA256 = /^[a-f0-9]{64}$/;
const FIELDS = ["mukey","cokey","chkey","hzdept_r","hzdepb_r","sandtotal_r","silttotal_r","claytotal_r"] as const;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const number = (value: unknown, label: string): number => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) throw new Error("SOIL_NUMERIC_VALUE_REQUIRED:" + label);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("SOIL_NUMERIC_VALUE_INVALID:" + label);
  return parsed;
};
const key = (value: unknown, label: string): string => {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("SOIL_ID_REQUIRED:" + label);
  const parsed = String(value).trim();
  if (!/^[0-9]{1,24}$/.test(parsed)) throw new Error("SOIL_ID_INVALID:" + label);
  return parsed;
};
function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function validateSoilProfile(profile: SoilProfile): readonly string[] {
  const errors: string[] = [];
  if (!profile || profile.verticalReference !== "NOT_APPLICABLE") errors.push("SOIL_DEPTH_IS_NOT_ABSOLUTE_ELEVATION");
  if (!profile?.mapUnitKey || !profile.componentKey || !SHA256.test(profile.sourceSha256)) errors.push("SOIL_IDENTITY_OR_SOURCE_HASH_INVALID");
  if (!profile?.horizons?.length) return [...errors, "SOIL_HORIZONS_REQUIRED"];
  let previousBottom = 0;
  const seen = new Set<string>();
  for (const horizon of profile.horizons) {
    if (!horizon.horizonKey || seen.has(horizon.horizonKey)) errors.push("SOIL_HORIZON_KEY_DUPLICATE_OR_MISSING");
    seen.add(horizon.horizonKey);
    const {topCm, bottomCm, sandPercent, siltPercent, clayPercent, availableWaterCapacityCmPerCm: awc} = horizon;
    if (![topCm,bottomCm,sandPercent,siltPercent,clayPercent].every(Number.isFinite)) errors.push("SOIL_NONFINITE_MEASUREMENT");
    if (topCm < 0 || bottomCm <= topCm || topCm < previousBottom) errors.push("SOIL_DEPTH_ORDER_INVALID");
    if ([sandPercent,siltPercent,clayPercent].some(v=>v<0 || v>100)) errors.push("SOIL_TEXTURE_OUT_OF_RANGE");
    if (Math.abs(sandPercent+siltPercent+clayPercent-100)>5) errors.push("SOIL_TEXTURE_SUM_INCONSISTENT");
    if (awc!==undefined && (!Number.isFinite(awc) || awc<0 || awc>1)) errors.push("SOIL_AWC_OUT_OF_RANGE");
    previousBottom = bottomCm;
  }
  return [...new Set(errors)];
}
/** Supports USDA SDA FORMAT=JSON+COLUMNNAME snapshots with a Table header row. */
export function importPinnedSdaSoils(bytes: Uint8Array, manifest: GovernmentSnapshotManifest): SoilImport {
  assertPromotableSnapshot(manifest);
  if (manifest.datasetId !== "usda.ssurgo") throw new Error("SOIL_SNAPSHOT_SOURCE_MISMATCH");
  if (!SHA256.test(manifest.sha256)) throw new Error("SOIL_SNAPSHOT_HASH_INVALID");
  if (!(bytes instanceof Uint8Array) || bytes.length !== manifest.byteLength) throw new Error("SOIL_SNAPSHOT_BYTE_LENGTH_MISMATCH");
  const actualHash = sha256(bytes);
  if (!timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(manifest.sha256, "hex"))) throw new Error("SOIL_SNAPSHOT_HASH_MISMATCH");
  let payload: unknown;
  try { payload = JSON.parse(utf8.decode(bytes)); } catch { throw new Error("SOIL_SNAPSHOT_JSON_INVALID"); }
  if (!payload || typeof payload!=="object" || !("Table" in payload)) throw new Error("SOIL_SDA_TABLE_REQUIRED");
  const table = (payload as {Table: unknown}).Table;
  if (!Array.isArray(table) || table.length<2 || !Array.isArray(table[0])) throw new Error("SOIL_SDA_HEADER_OR_ROWS_REQUIRED");
  const header = table[0] as unknown[];
  if (header.some(h=>typeof h!=="string") || new Set(header).size!==header.length) throw new Error("SOIL_SDA_HEADER_INVALID");
  const indexes = FIELDS.map(field=>header.indexOf(field));
  if (indexes.some(i=>i<0)) throw new Error("SOIL_SDA_REQUIRED_COLUMNS_MISSING");
  const awcIndex = header.indexOf("awc_r");
  const profiles = new Map<string, {mapUnitKey:string;componentKey:string;horizons:SoilHorizon[]}>();
  const horizonKeys = new Set<string>();
  for (let rowIndex=1;rowIndex<table.length;rowIndex++) {
    const row = table[rowIndex];
    if (!Array.isArray(row) || row.length!==header.length) throw new Error("SOIL_SDA_ROW_WIDTH_INVALID");
    const get = (field:typeof FIELDS[number])=>row[header.indexOf(field)] as unknown;
    const mukey = key(get("mukey"),"mukey");
    const cokey = key(get("cokey"),"cokey");
    const chkey = key(get("chkey"),"chkey");
    if (horizonKeys.has(chkey)) throw new Error("SOIL_SDA_DUPLICATE_HORIZON:"+chkey);
    horizonKeys.add(chkey);
    const topCm=number(get("hzdept_r"),"hzdept_r");
    const bottomCm=number(get("hzdepb_r"),"hzdepb_r");
    const sandPercent=number(get("sandtotal_r"),"sandtotal_r");
    const siltPercent=number(get("silttotal_r"),"silttotal_r");
    const clayPercent=number(get("claytotal_r"),"claytotal_r");
    const awc=awcIndex<0 || row[awcIndex]===null ? undefined : number(row[awcIndex],"awc_r");
    const profileKey = mukey + ":" + cokey;
    const profile=profiles.get(profileKey)??{mapUnitKey:mukey,componentKey:cokey,horizons:[]};
    profile.horizons.push({horizonKey:chkey,topCm,bottomCm,sandPercent,siltPercent,clayPercent, ...(awc===undefined?{}:{availableWaterCapacityCmPerCm:awc})});
    profiles.set(profileKey,profile);
  }
  const normalized: SoilProfile[] = [...profiles.values()].map(p=>({
    mapUnitKey:p.mapUnitKey, componentKey:p.componentKey,
    horizons:p.horizons.sort((a,b)=>a.topCm-b.topCm || a.horizonKey.localeCompare(b.horizonKey)),
    sourceDatasetId:"usda.ssurgo" as const,sourceSha256:actualHash,
    verticalReference:"NOT_APPLICABLE" as const
  })).sort((a,b)=>a.mapUnitKey.localeCompare(b.mapUnitKey)||a.componentKey.localeCompare(b.componentKey));
  for (const profile of normalized) {
    const errors=validateSoilProfile(profile);
    if (errors.length) throw new Error("SOIL_PROFILE_INVALID:"+errors.join(","));
  }
  // Derived content hash deliberately excludes retrieval time and JSON object key order.
  return {profiles:normalized,sourceSha256:actualHash,
    derivedSha256:sha256(JSON.stringify(normalized)),datasetVersion:manifest.sourceVersion,
    importedAt:manifest.retrievedAt,status:"DERIVED_UNCALIBRATED"};
}
