import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateHarvestCatalog, validateArcGisServiceMetadata } from "./validate-igio-harvest-contract.mjs";

const catalog = JSON.parse(await readFile(new URL("../../data/registries/indiana-gio-harvest-2025-v1.json", import.meta.url), "utf8"));
const cloned = () => structuredClone(catalog);

test("all four official mutable Current framework sources remain classified", () => {
  assert.equal(validateHarvestCatalog(catalog), 4);
  for (const source of catalog.sources) assert.match(source.url, /_Current\/FeatureServer$/);
});
test("current services cannot be relabeled with a verified datum, Posey vintage or 2025 imagery", () => {
  const bad = cloned();
  bad.imagery.poseyCountyVintage = "2025";
  assert.throws(() => validateHarvestCatalog(bad), /central-tier imagery/);
  const wrong = cloned();
  wrong.sources[0].verticalDatum = "NAVD88";
  assert.throws(() => validateHarvestCatalog(wrong), /safeguards/);
});
test("source host, hierarchy and geometry type are strictly validated", () => {
  const wrong = cloned();wrong.sources[0].url = "https://example.com/not-a-service";
  assert.throws(() => validateHarvestCatalog(wrong), /official HTTPS/);
  const fake = cloned();fake.sources[0].geometryType = "esriGeometryPoint";
  assert.throws(() => validateHarvestCatalog(fake), /safeguards/);
});
test("ArcGIS metadata verification never promotes a current service into a fixed vintage", () => {
  const source = catalog.sources.find(x=>x.kind==="parcel");
  const service = {spatialReference:{latestWkid:4326},layers:[{id:0,type:"Feature Layer",geometryType:"esriGeometryPolygon"}],description:"released in 2024"};
  const result = validateArcGisServiceMetadata(source,service);
  assert.equal(result.vintage,"UNVERIFIED");
  assert.equal(result.regulatoryAcceptance,false);
  assert.throws(()=>validateArcGisServiceMetadata(source,{...service,spatialReference:{latestWkid:2966}}),/SRID/);
  assert.throws(()=>validateArcGisServiceMetadata(source,{...service,layers:[{...service.layers[0],geometryType:"esriGeometryPoint"}]}),/not compatible/);
  assert.throws(()=>validateArcGisServiceMetadata(source,{...service,error:{code:500}}),/not compatible/);
});
test("published 3D tile deficit remains independent of IGIO Data Harvest",()=>{
  assert.equal(catalog.buildings.previousSourceTarget-catalog.buildings.publishedFeatureCount,267);
  const wrong = cloned();wrong.buildings.status="ACCEPTED";
  assert.throws(()=>validateHarvestCatalog(wrong),/building ID gap/);
});
