#!/usr/bin/env node
/** Validate official Indiana GIO service classification independently of availability.
 * This is NOT a county feature download, datum conversion or engineering approval.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const expectedKinds = new Map([
  ["parcel", "esriGeometryPolygon"],
  ["administrative", "esriGeometryPolygon"],
  ["roads", "esriGeometryPolyline"],
  ["addresses", "esriGeometryPoint"]
]);
const acceptedOrigin = "https://gisdata.in.gov";

export function validateHarvestCatalog(catalog) {
  if (!catalog || catalog.schemaVersion !== "tsm.igio-data-harvest-source-catalog.v1") {
    throw new Error("Invalid IGIO harvest catalog version");
  }
  const entries = catalog.sources;
  if (!Array.isArray(entries) || entries.length !== expectedKinds.size) {
    throw new Error("Expected exactly four Indiana Data Harvest framework services");
  }
  const seen = new Set();
  for (const entry of entries) {
    if (!expectedKinds.has(entry?.kind) || seen.has(entry.kind)) {
      throw new Error("Unexpected or duplicate framework source");
    }
    seen.add(entry.kind);
    const url = new URL(entry.url);
    if (url.origin !== acceptedOrigin || url.search || url.hash ||
        !url.pathname.endsWith("_Current/FeatureServer")) {
      throw new Error("IGIO must use exact official HTTPS _Current FeatureServer endpoints");
    }
    if (entry.sourceType !== "mutable-current-service" ||
        entry.authorityClass !== "INFORMATIONAL_ONLY" ||
        entry.verticalDatum !== "NOT_SPECIFIED" || entry.geometrySrid !== 4326 ||
        entry.geometryType !== expectedKinds.get(entry.kind) ||
        entry.countyCoverage !== "verify-geometry-at-extraction" ||
        !Number.isSafeInteger(entry.layerCountMin) || entry.layerCountMin < 1) {
      throw new Error("IGIO source authority, geometry or vintage safeguards violated");
    }
  }
  const imagery = catalog.imagery;
  if (!imagery || imagery.posey2025AcquisitionEvidence !== false ||
      imagery.poseyCountyVintage !== "UNVERIFIED" ||
      imagery.poseyRegion !== "western-Indiana-tier" ||
      imagery.collection2025Region !== "central-Indiana-tier" ||
      imagery.poseyCountyDataAcceptance !== "PENDING_METADATA_AND_COVERAGE_QA") {
    throw new Error("2025 central-tier imagery cannot be asserted as Posey imagery");
  }
  if (catalog.buildings?.status !== "INDEPENDENT_ACCEPTANCE" ||
      catalog.buildings?.publishedFeatureCount !== 22815 ||
      catalog.buildings?.previousSourceTarget !== 23082) {
    throw new Error("Framework source updates may not close the building ID gap");
  }
  return entries.length;
}

/** Verify a fetched FeatureServer metadata document matches cataloged layer types.
 * Never derive a product year from a mutable service name or stale description.
 */
export function validateArcGisServiceMetadata(source, metadata) {
  if (!source || !metadata || metadata.error ||
      !Array.isArray(metadata.layers) ||
      metadata.layers.length < source.layerCountMin ||
      metadata.layers.some(layer => !Number.isInteger(layer.id) ||
        layer.type !== "Feature Layer" || layer.geometryType !== source.geometryType)) {
    throw new Error("FeatureServer metadata not compatible with declared IGIO geometry contract");
  }
  const srid = metadata.spatialReference?.latestWkid ?? metadata.spatialReference?.wkid;
  if (srid !== source.geometrySrid) {
    throw new Error("Unexpected service geometry SRID; explicit transform required");
  }
  return Object.freeze({
    id: source.id,
    serviceLayerCount: metadata.layers.length,
    geometrySrid: srid,
    vintage: "UNVERIFIED",
    countyCompleteness: "UNVERIFIED",
    regulatoryAcceptance: false
  });
}

export async function validateFile() {
  const path = new URL("../../data/registries/indiana-gio-harvest-2025-v1.json", import.meta.url);
  const catalog = JSON.parse(await readFile(path, "utf8"));
  return validateHarvestCatalog(catalog);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  validateFile().then(n=>console.log("IGIO 2025 harvest catalog verified: "+n+" sources"))
    .catch(err=>{console.error(err.message);process.exitCode=1;});
}
