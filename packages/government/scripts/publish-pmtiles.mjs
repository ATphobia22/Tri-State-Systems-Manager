#!/usr/bin/env node
/** Opt-in, offline-safe GeoJSON -> PMTiles publication. Run on an ingestion workstation.
 * Requires Tippecanoe >= 2.17 already installed. Never invents source metadata.
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [inputPath,manifestPath,outputPath,layer] = process.argv.slice(2);
if(!inputPath||!manifestPath||!outputPath||!layer||! /^[a-z][a-z0-9_]{0,47}$/.test(layer)){
 console.error('usage: node publish-pmtiles.mjs input.geojson manifest.json output.pmtiles layer_name');
 process.exit(2);
}
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
const input=resolve(inputPath),output=resolve(outputPath);
if(input===output)throw Error('OUTPUT_EQUALS_INPUT');
const [bytes,manifestBytes]=await Promise.all([readFile(input),readFile(manifestPath)]);
const manifest=JSON.parse(manifestBytes.toString('utf8'));
if(!/^[a-f0-9]{64}$/.test(manifest.sha256)||sha(bytes)!==manifest.sha256)throw Error('SOURCE_HASH_MISMATCH');
if(manifest.validationStatus!=='PASS')throw Error('SOURCE_NOT_VALIDATED');
if(manifest.horizontalCrs!=='EPSG:4326')throw Error('REPROJECT_TO_EPSG_4326_BEFORE_TILING');
if(!manifest.sourceUrl||!manifest.license||!manifest.attribution||!manifest.datasetId||!manifest.retrievedAt)throw Error('INCOMPLETE_SOURCE_MANIFEST');
const json=JSON.parse(bytes.toString('utf8'));
if(json.type!=='FeatureCollection'||!Array.isArray(json.features))throw Error('REQUIRES_GEOJSON_FEATURE_COLLECTION');
if(json.features.some(f=>f?.type!=='Feature'||!f.geometry||!f.properties))throw Error('INVALID_GEOJSON_FEATURE');
if(json.features.some(f=>f.properties?.classification==='SCENARIO_SIMULATION_DEMO'))throw Error('NO_SCENARIO_GEOMETRY_IN_GOVERNMENT_TILESET');
await new Promise((ok,fail)=>{
 const child=spawn('tippecanoe',['-Z','0','-z','14','--no-feature-limit','--no-tile-size-limit','--layer',layer,'--output',output,input],{stdio:'inherit',shell:false});
 child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error('TIPPECANOE_FAILED_'+code)));
});
const published=await readFile(output);
if(published.byteLength===0)throw Error('EMPTY_PMTILES');
const record={schemaVersion:'1.0.0',datasetId:manifest.datasetId,sourceSha256:manifest.sha256,tilesSha256:sha(published),
 sourceUrl:manifest.sourceUrl,retrievedAt:manifest.retrievedAt,createdAt:new Date().toISOString(),
 layer,featureCount:json.features.length,classification:manifest.classification??'UNKNOWN',
 attribution:manifest.attribution,license:manifest.license,horizontalCrs:'EPSG:4326',
 verticalDatum:manifest.verticalDatum??null,format:'PMTiles',validation:'BUILT_NOT_FIELD_VERIFIED'};
await writeFile(output+'.manifest.json',JSON.stringify(record,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,bytes:(await stat(output)).size,manifest:output+'.manifest.json'},null,2));
