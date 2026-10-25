import test from "node:test";
import assert from "node:assert/strict";
import { TextEncoder } from "node:util";
import { createSnapshotManifest } from "../../packages/government/src/ingestion.ts";
import {
  AGRICULTURAL_ENGINE_CATALOG, assessClosedBucketWaterBalance, createAgriculturalExecutionPlan,
  importPinnedSdaSoils, validateAgriculturalSpatialContext, validateDailyAgriculturalWeather,validateSoilProfile
} from "../../packages/agriculture/src/index.ts";
import { HorizontalDatum, VerticalDatum } from "../../packages/geo/src/geodesy/index.ts";

const encoder=new TextEncoder();
const sha=(letter:string)=>letter.repeat(64);
const goodRows=[
 ["mukey","cokey","chkey","hzdept_r","hzdepb_r","sandtotal_r","silttotal_r","claytotal_r","awc_r"],
 ["42","70","102","20","60","35","40","25","0.12"],
 ["42","70","101","0","20","40","35","25","0.15"]
];
const source=(rows:unknown=goodRows)=>{
 const bytes=encoder.encode(JSON.stringify({Table:rows}));
 const manifest=createSnapshotManifest({datasetId:"usda.ssurgo",authority:"USDA NRCS",sourceUrl:"https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest",
 retrievedAt:"2026-10-25T00:00:00Z",sourceVersion:"fixture-1",mediaType:"application/json",attribution:"USDA NRCS SDA",
 license:"US Government work",horizontalCrs:"EPSG:4326",acquisitionDate:"2026-10-25",schemaVersion:"sda-table-v1",validationStatus:"PASS",bytes});
 return {bytes,manifest};
};
test("SDA importer verifies pinned bytes, sorts horizons, keeps soil depth out of NAVD88",()=>{
 const {bytes,manifest}=source();const one=importPinnedSdaSoils(bytes,manifest);const two=importPinnedSdaSoils(bytes,manifest);
 assert.deepEqual(one,two);
 assert.equal(one.profiles.length,1);
 assert.equal(one.profiles[0].mapUnitKey,"42");
 assert.equal(one.profiles[0].horizons[0].horizonKey,"101");
 assert.equal(one.profiles[0].verticalReference,"NOT_APPLICABLE");
 assert.equal(one.status,"DERIVED_UNCALIBRATED");
 assert.match(one.derivedSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(validateSoilProfile(one.profiles[0]),[]);
});
test("USDA SDA tampered source, partial source, and unvalidated sources are blocked",()=>{
 const {bytes,manifest}=source();
 const tampered=Uint8Array.from(bytes);tampered[tampered.length-1]=0x20;
 assert.throws(()=>importPinnedSdaSoils(tampered,manifest),/HASH_MISMATCH/);
 assert.throws(()=>importPinnedSdaSoils(bytes.slice(0,-1),manifest),/BYTE_LENGTH_MISMATCH/);
 assert.throws(()=>importPinnedSdaSoils(bytes,{...manifest,validationStatus:"UNVERIFIED"}),/REQUIRES_VALIDATION_PASS/);
 assert.throws(()=>importPinnedSdaSoils(bytes,{...manifest,datasetId:"usda.cropland"}),/SOURCE_MISMATCH/);
});
test("USDA SDA rejects missing scientific attributes, duplicate horizons, and invalid depth",()=>{
 assert.throws(()=>{const v=source([goodRows[0].slice(0,-1).filter(x=>x!=="claytotal_r"),goodRows[1].slice(0,-1).filter((_,i)=>i!==7)]);importPinnedSdaSoils(v.bytes,v.manifest);},/REQUIRED_COLUMNS_MISSING/);
 const duplicate=source([goodRows[0],goodRows[1],goodRows[1]]);
 assert.throws(()=>importPinnedSdaSoils(duplicate.bytes,duplicate.manifest),/DUPLICATE_HORIZON/);
 const invalid=source([goodRows[0],["42","70","101","40","20","40","35","25","0.15"]]);
 assert.throws(()=>importPinnedSdaSoils(invalid.bytes,invalid.manifest),/SOIL_PROFILE_INVALID/);
 const mixture=source([goodRows[0],["42","70","101","0","20","100","40","25","0.15"]]);
 assert.throws(()=>importPinnedSdaSoils(mixture.bytes,mixture.manifest),/SOIL_PROFILE_INVALID/);
});
const spatial={epsg:4326,horizontalDatum:HorizontalDatum.WGS84,horizontalUnits:"degree" as const,vertical:{kind:"NOT_APPLICABLE" as const,reason:"Only field location and non-elevation depths"}};
test("agricultural spatial policy distinguishes horizontal CRS from vertical quantities",()=>{
 assert.deepEqual(validateAgriculturalSpatialContext(spatial),[]);
 assert.ok(validateAgriculturalSpatialContext({...spatial,epsg:2966}).includes("AGRICULTURAL_HORIZONTAL_DATUM_MISMATCH"));
 assert.ok(validateAgriculturalSpatialContext({...spatial,epsg:3857,horizontalUnits:"m"}).includes("AGRICULTURAL_CRS_IS_DISPLAY_ONLY"));
 assert.ok(validateAgriculturalSpatialContext({...spatial,vertical:{kind:"ABSOLUTE_ELEVATION",units:"m",reference:{epsg:4326,horizontalDatum:HorizontalDatum.WGS84,verticalDatum:VerticalDatum.UNKNOWN}}}).includes("VERTICAL_DATUM_REQUIRED"));
});
test("agricultural engine inventory is unique and license review prevents restricted execution plans",()=>{
 assert.equal(AGRICULTURAL_ENGINE_CATALOG.length,12);
 assert.equal(new Set(AGRICULTURAL_ENGINE_CATALOG.map(e=>e.id)).size,12);
 assert.ok(AGRICULTURAL_ENGINE_CATALOG.every(e=>new URL(e.repo).protocol==="https:"));
 const plan=createAgriculturalExecutionPlan({engineId:"aquacrop-ospy",executableSha256:sha("a"),inputManifestSha256:sha("b"),configurationSha256:sha("c"),
 spatial,firstDay:"2026-04-01",lastDay:"2026-10-31"});
 assert.equal(plan.executionStatus,"NOT_EXECUTED");
 assert.equal(plan.scientificStatus,"HUMAN_REVIEW_REQUIRED");
 assert.match(plan.planSha256,/^[a-f0-9]{64}$/);
 assert.throws(()=>createAgriculturalExecutionPlan({...plan,engineId:"fao-aquacrop-7.3"}),/LICENSE_REVIEW_REQUIRED/);
 assert.throws(()=>createAgriculturalExecutionPlan({...plan,engineId:"soildb"}),/NOT_A_SOLVER/);
 assert.throws(()=>createAgriculturalExecutionPlan({...plan,engineId:"aquacrop-ospy",executableSha256:"not-a-hash"}),/HASH_REQUIRED/);
});
test("daily weather requires continuous valid dates, physical precipitation and temperature bounds",()=>{
 const days=[{day:"2026-04-01",precipitationMm:1,minimumTemperatureC:5,maximumTemperatureC:18},{day:"2026-04-02",precipitationMm:0,minimumTemperatureC:3,maximumTemperatureC:20,referenceEtMm:2}];
 assert.deepEqual(validateDailyAgriculturalWeather(days),[]);
 assert.ok(validateDailyAgriculturalWeather([days[0],{...days[1],day:"2026-04-04"}]).includes("AGRICULTURAL_WEATHER_DATE_GAP_OR_ORDER"));
 assert.ok(validateDailyAgriculturalWeather([{...days[0],precipitationMm:-1}]).includes("AGRICULTURAL_WEATHER_NEGATIVE_DEPTH"));
 assert.ok(validateDailyAgriculturalWeather([{...days[0],day:"2026-02-30"}]).includes("AGRICULTURAL_WEATHER_DATE_INVALID"));
});
test("single-bucket check enforces conservation but never claims physical validation",()=>{
 const base={initialStorageMm:100,precipitationMm:20,irrigationMm:10,finalStorageMm:90,evapotranspirationMm:15,runoffMm:20,deepDrainageMm:5,toleranceMm:0.01};
 assert.deepEqual(assessClosedBucketWaterBalance(base),{valid:true,residualMm:0,status:"NUMERICAL_CHECK_PASS"});
 assert.equal(assessClosedBucketWaterBalance({...base,finalStorageMm:85}).status,"NUMERICAL_CHECK_FAIL");
 assert.throws(()=>assessClosedBucketWaterBalance({...base,irrigationMm:-1}),/VALUES_INVALID/);
});
