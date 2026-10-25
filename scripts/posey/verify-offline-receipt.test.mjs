import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {verifyOfflineReceipt,resolveSafeAsset,ReceiptIntegrityError} from './verify-offline-receipt.mjs';
const hash=data=>createHash('sha256').update(data).digest('hex');
const source=JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{GEOID:'18129'}}]});
function fixture(){
  const tmp=mkdtempSync(path.join(tmpdir(),'tsm-posey-receipt-')),root=path.join(tmp,'offline');
  mkdirSync(path.join(root,'boundary'),{recursive:true});mkdirSync(path.join(root,'fema'),{recursive:true});
  writeFileSync(path.join(root,'boundary','county.geojson'),source);
  writeFileSync(path.join(root,'fema','source.geojson'),source);
  const make=(id,p,authority,relation)=>({id,path:p,authority,url:'https://example.gov/record',sha256:hash(source),bytes:Buffer.byteLength(source),featureCount:1,spatialRelation:relation,status:'acquired'});
  const receipt={schema:'tsm-posey-offline-download-receipt-v2',countyFips:'18129',countyGEOID:'18129',
    geographyPolicy:{spatialRelation:'exact-county',boundaryVintage:'2023'},files:[
    make('posey-county-boundary','boundary/county.geojson','US_CENSUS_BUREAU','exact-boundary'),
    make('fema-test','fema/source.geojson','FEMA','esriSpatialRelIntersects')]};
  const requirements={county:{fips:'18129'},requiredSources:[{id:'fema-test',authority:'FEMA',required:true,minimumFeatureCount:1}]};
  const requirementsPath=path.join(tmp,'requirements.json');
  function save(){writeFileSync(path.join(root,'download-receipt-v2.json'),JSON.stringify(receipt));writeFileSync(requirementsPath,JSON.stringify(requirements));}
  save();
  return {tmp,root,requirementsPath,receipt,requirements,save};
}
async function invalid(edit,expected){
  const fx=fixture();
  try{edit(fx);fx.save();await assert.rejects(verifyOfflineReceipt(fx),
    err=>err instanceof ReceiptIntegrityError&&err.issues.some(x=>x.includes(expected)));}
  finally{rmSync(fx.tmp,{recursive:true,force:true});}
}
test('valid exact-county acquisition succeeds without approving site AOI',async()=>{
 const fx=fixture();try{const result=await verifyOfflineReceipt(fx);assert.equal(result.status,'PASS');assert.equal(result.siteAoiApproval,'NOT_APPROVED');}
 finally{rmSync(fx.tmp,{recursive:true,force:true});}
});
test('modified bytes are rejected even when receipt is unchanged',async()=>{
 await invalid(fx=>writeFileSync(path.join(fx.root,'fema','source.geojson'),source+' '),'SHA-256 mismatch');
});
test('wrong receipt sizes and feature counts are rejected',async()=>{
 await invalid(fx=>{fx.receipt.files[1].bytes=5;},'byte-count mismatch');
 await invalid(fx=>{fx.receipt.files[1].featureCount=99;},'declared feature count');
});
test('required source outages cannot silently publish a partial bundle',async()=>{
 await invalid(fx=>{Object.assign(fx.receipt.files[1],{status:'unavailable-igio-outage',path:null,sha256:null});},'required source unavailable');
});
test('duplicate IDs and dangerous file paths are rejected',async()=>{
 await invalid(fx=>{fx.receipt.files.push({...fx.receipt.files[1]});},'duplicate source ID');
 await invalid(fx=>{fx.receipt.files[1].path='../escape';},'unsafe relative path');
 assert.throws(()=>resolveSafeAsset('/tmp','C:\\Windows\\System32'),/unsafe relative path/);
});
test('symlink targets outside offline root cannot be accepted',()=>{
 const fx=fixture();try{symlinkSync(path.join(fx.tmp,'outside'),path.join(fx.root,'boundary','link'));assert.throws(()=>resolveSafeAsset(fx.root,'boundary/link/x'),/symlink/);}
 finally{rmSync(fx.tmp,{recursive:true,force:true});}
});
test('explicitly nonmandatory catalog layers may remain unavailable',async()=>{
 const fx=fixture();try{
  fx.requirements.requiredSources.push({id:'optional-source',authority:'Indiana GIO',required:false,minimumFeatureCount:0});
  fx.receipt.files.push({id:'optional-source',authority:'Indiana GIO',status:'unavailable-igio-outage',path:null,sha256:null});
  fx.save();assert.equal((await verifyOfflineReceipt(fx)).status,'PASS');
 }finally{rmSync(fx.tmp,{recursive:true,force:true});}
});
test('HTML presented as official GeoJSON is rejected',async()=>{
 await invalid(fx=>{const html='<html>gateway</html>';writeFileSync(path.join(fx.root,'fema','source.geojson'),html);
  fx.receipt.files[1].bytes=Buffer.byteLength(html);fx.receipt.files[1].sha256=hash(html);},'invalid JSON');
});
