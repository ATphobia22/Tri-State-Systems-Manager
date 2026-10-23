import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceAuthorityLevel, GOVERNMENT_SOURCES, getRegisteredGovernmentSource, validateGovernmentSourceRegistry } from '../../packages/government/src/GovernmentSourceRegistry.ts';
import { GeometryValidator } from '../../packages/government/src/validators/GeometryValidator.ts';
import { DatasetValidator } from '../../packages/government/src/validators/DatasetValidator.ts';
import { MetadataValidator } from '../../packages/government/src/validators/MetadataValidator.ts';
import { GovernmentSourceCapabilityProvider } from '../../packages/government/src/GovernmentSourceCapabilityProvider.ts';

test('source registry contains requested agencies with HTTPS provenance policies',()=>{
 assert.deepEqual(validateGovernmentSourceRegistry(),[]);
 for(const id of ['fema.nfhl','fema.riskmap','fema.loma','fema.lomr','usgs.3dep','usgs.nhd','noaa.coastal','noaa.tides','noaa.weather','census.tiger','census.places','epa.waters','epa.facilities','usda.ssurgo','dot.nbi','army-corps.levees'])assert.ok(getRegisteredGovernmentSource(id));
 assert.equal(getRegisteredGovernmentSource('fema.nfhl').authorityLevel,SourceAuthorityLevel.AUTHORITATIVE);
 for(const source of GOVERNMENT_SOURCES){assert.equal(new URL(source.endpoint).protocol,'https:');assert.equal(source.citationRequired,true);assert.equal(source.provenanceRequired,true);}
});
test('geometry validator accepts all six supported types and rejects unsupported types',()=>{
 const validator=new GeometryValidator();
 for(const type of ['Point','MultiPoint','Polygon','MultiPolygon','Polyline','MultiLineString'])assert.equal(validator.validate(type).passed,true);
 assert.equal(validator.validate('Triangle').passed,false);
 assert.equal(validator.validate('Polygon','MultiPolygon').passed,false);
});
test('dataset validator enforces metadata timestamps hashes counts and geometry',()=>{
 const validator=new DatasetValidator();
 const valid={sourceId:'fema.nfhl',datasetName:'NFHL',version:'2026-10-23',retrievedAt:'2026-10-23T00:00:00Z',checksum:'a'.repeat(64),featureCount:0,geometryType:'Polygon'};
 assert.deepEqual(validator.validate(valid),[]);
 assert.ok(validator.validate({...valid,checksum:'bad',featureCount:-1,geometryType:'Triangle'}).length>=3);
});
test('metadata validator hashes canonical layer metadata and catches count/name/geometry drift',()=>{
 const validator=new MetadataValidator();
 const expected=[{id:0,name:'Flood Hazard Areas',geometryType:'Polygon'},{id:1,name:'Cross Sections',geometryType:'Polyline'}];
 const pass=validator.validateLayers(expected,[...expected].reverse());
 assert.equal(pass.passed,true);assert.match(pass.metadataHash,/^[a-f0-9]{64}$/);
 const fail=validator.validateLayers(expected,[{...expected[0],name:'renamed'},expected[1],{id:2,name:'extra',geometryType:'Point'}]);
 assert.equal(fail.passed,false);assert.ok(fail.errors.includes('LAYER_COUNT_MISMATCH:2:3'));assert.ok(fail.errors.includes('LAYER_NAME_MISMATCH:0'));
});
test('UACF source capability provider fails closed for unimplemented ingest/publish',async()=>{
 const provider=new GovernmentSourceCapabilityProvider();
 for(const id of ['source.fetch','source.validate','source.hash','source.register'])assert.ok(provider.capabilities.some(c=>c.id===id));
 assert.equal((await provider.supports('source.register',{sourceId:'fema.nfhl'})).supported,true);
 assert.equal((await provider.supports('source.register',{sourceId:'unknown'})).supported,false);
 assert.equal((await provider.supports('source.ingest',{sourceId:'fema.nfhl'})).supported,false);
 assert.equal((await provider.supports('source.publish',{sourceId:'fema.nfhl'})).supported,false);
});
