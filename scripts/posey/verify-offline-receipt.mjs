#!/usr/bin/env node
// Independent byte-level acquisition gate. County geometry is audited by validate-exact-county.mjs.
import {createHash} from 'node:crypto';
import {createReadStream,existsSync,lstatSync,realpathSync,readFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const shaRe=/^[0-9a-f]{64}$/;
const knownSpatial=new Set(['esriSpatialRelWithin','esriSpatialRelIntersects','exact-county-attribute','exact-county-clip','coverage-reference','exact-boundary','history']);
export class ReceiptIntegrityError extends Error {
  constructor(issues){super('Posey offline acquisition rejected:\n- '+issues.join('\n- '));this.issues=issues;}
}
const json=(file)=>JSON.parse(readFileSync(file,'utf8'));
export function resolveSafeAsset(root,relative) {
  if(typeof relative!=='string'||!relative||relative.includes('\0'))throw Error('missing asset path');
  const normalized=relative.replaceAll('\\','/');
  if(normalized.startsWith('/')||/^[a-zA-Z]:/.test(normalized)||normalized.split('/').some(x=>!x||x==='.'||x==='..'))
    throw Error('unsafe relative path');
  const rootReal=realpathSync(root);let current=rootReal;
  for(const component of normalized.split('/')){
    current=path.join(current,component);
    if(lstatSync(current).isSymbolicLink())throw Error('symlink path is forbidden');
  }
  const asset=realpathSync(current);
  if(!asset.startsWith(rootReal+path.sep)||!statSync(asset).isFile())throw Error('asset escapes bundle or is not a regular file');
  return asset;
}
async function digest(file){
  const hash=createHash('sha256');
  for await(const bytes of createReadStream(file))hash.update(bytes);
  return hash.digest('hex');
}
function allowedUrl(source){
  try{const url=new URL(source);return url.protocol==='https:'&&!url.username&&!url.password&&!!url.hostname;}
  catch{return false;}
}
function checkMagic(file,relative,id,errors){
  const ext=path.extname(relative).toLowerCase();
  if(!['.zip','.pdf','.tif','.tiff'].includes(ext))return;
  const fd=openSync(file,'r');const magic=Buffer.alloc(8);
  try{readSync(fd,magic,0,8,0);}finally{closeSync(fd);}
  const zip=magic[0]===80&&magic[1]===75&&([3,5].includes(magic[2]))&&([4,6].includes(magic[3]));
  const pdf=magic.toString('ascii',0,5)==='%PDF-';
  const tif=((magic[0]===73&&magic[1]===73)||(magic[0]===77&&magic[1]===77))&&
    ([42,43].includes(magic[2])&&magic[3]===0||magic[2]===0&&[42,43].includes(magic[3]));
  if(ext==='.zip'&&!zip||ext==='.pdf'&&!pdf||['.tif','.tiff'].includes(ext)&&!tif)
    errors.push(id+': binary signature mismatch (possibly an upstream error page)');
}
async function inspectRecords(file,relative,entry,errors){
  const ext=path.extname(relative).toLowerCase();
  if(ext==='.ndjson'){
    if(!Number.isSafeInteger(entry.featureCount)){errors.push(entry.id+': NDJSON missing feature count');return;}
    let count=0;
    const rl=createInterface({input:createReadStream(file),crlfDelay:Infinity});
    for await(const line of rl){
      if(!line.trim()){errors.push(entry.id+': blank NDJSON record');continue;}
      let row;try{row=JSON.parse(line);}catch{errors.push(entry.id+': malformed NDJSON record');continue;}
      count++;
      if(entry.id==='usgs-03378500-daily-mean-history'&&
        (row.monitoring_location_id!=='USGS-03378500'||row.parameter_code!=='00060'||
         row.statistic_id!=='00003'||row.unit!=='ft^3/s'||
         !Number.isFinite(row.discharge_cfs)||row.discharge_cfs<0||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)))
        errors.push(entry.id+': inconsistent USGS daily-discharge row');
    }
    if(count!==entry.featureCount)errors.push(entry.id+': NDJSON feature-count mismatch');
    return;
  }
  if(ext!=='.geojson'&&ext!=='.json')return;
  if(statSync(file).size>512*1024*1024){errors.push(entry.id+': JSON too large for bounded semantic validation');return;}
  let doc;try{doc=json(file);}catch{errors.push(entry.id+': invalid JSON');return;}
  if(ext==='.geojson'&&(doc.type!=='FeatureCollection'||!Array.isArray(doc.features)))
    errors.push(entry.id+': invalid GeoJSON FeatureCollection');
  if(Number.isSafeInteger(entry.featureCount)&&(!Array.isArray(doc.features)||doc.features.length!==entry.featureCount))
    errors.push(entry.id+': declared feature count does not equal parsed feature count');
}
export async function verifyOfflineReceipt({root,requirementsPath}){
  const receipt=json(path.join(root,'download-receipt-v2.json')),requirements=json(requirementsPath);
  const errors=[],byId=new Map(),paths=new Set();
  if(receipt.schema!=='tsm-posey-offline-download-receipt-v2'||receipt.countyFips!=='18129'||receipt.countyGEOID!=='18129')
    errors.push('receipt schema or county identity mismatch');
  if(receipt.geographyPolicy?.spatialRelation!=='exact-county'||receipt.geographyPolicy?.boundaryVintage!=='2023')
    errors.push('county spatial policy or boundary vintage mismatch');
  if(requirements.county?.fips!=='18129'||!Array.isArray(requirements.requiredSources))
    errors.push('invalid Posey requirements document');
  if(!Array.isArray(receipt.files))errors.push('receipt files must be an array');
  for(const entry of receipt.files??[]){
    if(!entry||typeof entry.id!=='string'||!entry.id){errors.push('invalid entry');continue;}
    if(byId.has(entry.id))errors.push(entry.id+': duplicate source ID');
    byId.set(entry.id,entry);
    const acquired=['acquired','acquired-from-cache'].includes(entry.status);
    if(!acquired){
      if(entry.status!=='unavailable-igio-outage')errors.push(entry.id+': unknown availability status');
      if(entry.path||entry.sha256)errors.push(entry.id+': unavailable receipt claims local bytes');
      continue;
    }
    if(!allowedUrl(entry.url))errors.push(entry.id+': expected credential-free HTTPS source URL');
    if(!shaRe.test(entry.sha256??'')||entry.sha256==='0'.repeat(64))errors.push(entry.id+': missing or placeholder SHA-256');
    if(typeof entry.path!=='string'||!entry.path){errors.push(entry.id+': no asset path');continue;}
    const normalized=entry.path.replaceAll('\\','/').toLowerCase();
    if(paths.has(normalized))errors.push(entry.id+': duplicate asset path');
    paths.add(normalized);
    let file;try{file=resolveSafeAsset(root,entry.path);}catch(error){errors.push(entry.id+': '+error.message);continue;}
    const size=statSync(file).size;
    if(!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||entry.bytes!==size)errors.push(entry.id+': byte-count mismatch');
    if(shaRe.test(entry.sha256??'')&&await digest(file)!==entry.sha256)errors.push(entry.id+': SHA-256 mismatch');
    if(entry.featureCount!==undefined&&entry.featureCount!==null&&(!Number.isSafeInteger(entry.featureCount)||entry.featureCount<0))
      errors.push(entry.id+': invalid feature count');
    if(entry.spatialRelation&&!knownSpatial.has(entry.spatialRelation))errors.push(entry.id+': unrecognized spatial relation');
    checkMagic(file,entry.path,entry.id,errors);
    await inspectRecords(file,entry.path,entry,errors);
  }
  for(const expected of requirements.requiredSources??[]){
    const entry=byId.get(expected.id);
    if(!entry){errors.push(expected.id+': missing receipt');continue;}
    const acquired=['acquired','acquired-from-cache'].includes(entry.status);
    if(!acquired){
      if(expected.required!==false)errors.push(expected.id+': required source unavailable');
      continue;
    }
    if(entry.authority!==expected.authority)errors.push(expected.id+': authority mismatch');
    if(expected.minimumBytes!==undefined&&entry.bytes<expected.minimumBytes)errors.push(expected.id+': insufficient bytes');
    if(expected.minimumFeatureCount!==undefined&&
       (!Number.isSafeInteger(entry.featureCount)||entry.featureCount<expected.minimumFeatureCount))
      errors.push(expected.id+': missing or insufficient feature count');
  }
  if(errors.length)throw new ReceiptIntegrityError(errors);
  return {schema:'tsm-posey-offline-receipt-audit-v1',status:'PASS',verifiedAssetCount:byId.size,
    requiredSourceCount:requirements.requiredSources.length,siteAoiApproval:'NOT_APPROVED'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const argv=process.argv.slice(2);const i=argv.indexOf('--root'),j=argv.indexOf('--requirements');
    if(i<0||j<0||!argv[i+1]||!argv[j+1])throw Error('usage: --root <bundle> --requirements <json>');
    console.log(JSON.stringify(await verifyOfflineReceipt({root:argv[i+1],requirementsPath:argv[j+1]})));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
