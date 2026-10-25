#!/usr/bin/env node
// Explicit historical-data acquisition from the USGS OGC API v1 daily collection.
// A successful download is ACQUIRED_UNVERIFIED, never solver calibration.
import {createHash,randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const ENDPOINT='https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items';
const DAY=/^\d{4}-\d\d-\d\d$/;
function validDate(date){
 if(typeof date!=='string'||!DAY.test(date))return false;
 const parsed=new Date(date+'T00:00:00Z');
 return Number.isFinite(parsed.valueOf())&&parsed.toISOString().startsWith(date);
}
export function buildDailyUrl({site,start,end,limit=10000}){
 if(!/^\d{8}$/.test(site))throw Error('USGS site must contain eight digits');
 if(!validDate(start)||!validDate(end)||start>end)throw Error('invalid daily date interval');
 if(!Number.isSafeInteger(limit)||limit<1||limit>10000)throw Error('invalid page limit');
 const url=new URL(ENDPOINT);
 for(const [key,value] of Object.entries({f:'json',monitoring_location_id:'USGS-'+site,
   parameter_code:'00060',statistic_id:'00003',time:start+'/'+end,limit:String(limit)}))
   url.searchParams.set(key,value);
 return url;
}
function nextUrl(href,current,first){
 const url=new URL(href,current);
 if(url.origin!==first.origin||url.pathname!==first.pathname||url.username||url.password)
   throw Error('USGS next link left trusted collection');
 for(const key of ['monitoring_location_id','parameter_code','statistic_id','time'])
   if(url.searchParams.get(key)!==first.searchParams.get(key))throw Error('USGS next link changed source filter');
 url.searchParams.set('f','json');
 return url;
}
function normalizeFeature(feature,site,start,end){
 const p=feature?.properties;
 if(!p||p.monitoring_location_id!=='USGS-'+site||p.parameter_code!=='00060'||p.statistic_id!=='00003')
   throw Error('USGS returned wrong station, parameter or statistic');
 if(!validDate(p.time)||p.time<start||p.time>end)throw Error('USGS returned observation outside date range');
 if(p.unit_of_measure!=='ft^3/s')throw Error('USGS daily discharge has unexpected units');
 if(!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(String(p.value)))
   throw Error('USGS daily discharge is not a finite nonnegative number');
 const discharge=Number(p.value);
 if(!Number.isFinite(discharge))throw Error('nonfinite discharge');
 return {monitoring_location_id:p.monitoring_location_id,date:p.time,parameter_code:'00060',
   statistic_id:'00003',discharge_cfs:discharge,unit:p.unit_of_measure,
   timeseries_id:typeof p.timeseries_id==='string'?p.timeseries_id:null,
   approvals_status:Array.isArray(p.approvals_status)?p.approvals_status:null,
   approval_status:typeof p.approval_status==='string'?p.approval_status:null,
   qualifier:p.qualifier??null,last_modified:p.last_modified??null};
}
export async function fetchDailyMeanDischarge({site,start,end,fetcher=fetch,apiKey,limit=10000,maxPages=10000}){
 const first=buildDailyUrl({site,start,end,limit}),pages=[],rows=[],seen=new Set();
 let url=first;
 for(let page=0;url&&page<maxPages;page++){
   if(seen.has(url.href))throw Error('USGS paging cycle detected');
   seen.add(url.href);
   const headers={Accept:'application/geo+json,application/json','User-Agent':'TSM-Posey-Data/1.0'};
   if(apiKey)headers['X-Api-Key']=apiKey; // Never put credentials in the URL/receipt
   const res=await fetcher(url.href,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!res.ok)throw Error('USGS OGC daily API returned HTTP '+res.status);
   if(!/json/i.test(res.headers.get('content-type')??''))throw Error('USGS daily response not JSON');
   if(Number(res.headers.get('content-length'))>16_000_000)throw Error('USGS page too large');
   const body=await res.text();
   if(Buffer.byteLength(body)>16_000_000)throw Error('USGS page too large');
   let doc;try{doc=JSON.parse(body);}catch{throw Error('USGS daily JSON parse error');}
   if(doc?.type!=='FeatureCollection'||!Array.isArray(doc.features))throw Error('USGS daily shape invalid');
   const currentRows=doc.features.map(feature=>normalizeFeature(feature,site,start,end));
   pages.push({url:url.href,sha256:createHash('sha256').update(body).digest('hex'),count:currentRows.length});
   rows.push(...currentRows);
   const links=(doc.links??[]).filter(link=>link?.rel==='next');
   if(links.length>1)throw Error('ambiguous USGS pagination');
   if(!currentRows.length&&links.length)throw Error('USGS empty page with continuation');
   url=links.length?nextUrl(links[0].href,url,first):null;
 }
 if(url)throw Error('USGS pagination limit exceeded');
 if(!rows.length)throw Error('USGS reported no daily mean discharge for requested interval');
 const unique=new Set();
 for(const row of rows){
   const key=row.date+':'+(row.timeseries_id??'');
   if(unique.has(key))throw Error('duplicate daily record across pages: '+key);
   unique.add(key);
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||String(a.timeseries_id).localeCompare(String(b.timeseries_id)));
 return {rows,pages,query:first.href};
}
export async function writeDailySnapshot({site,start,end,output,summary,fetcher=fetch,apiKey}){
 if(!output||!summary||path.resolve(output)===path.resolve(summary))throw Error('separate data and provenance output files required');
 const {rows,pages,query}=await fetchDailyMeanDischarge({site,start,end,fetcher,apiKey});
 const data=rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
 const hash=createHash('sha256').update(data).digest('hex');
 const receipt={schema:'tsm-usgs-daily-mean-ogc-v1',sourceUrl:query,sourceVersion:'ogcapi-v1',
   station:'USGS-'+site,parameterCode:'00060',statisticId:'00003',range:{start,end},
   observationCount:rows.length,sourcePageReceipts:pages,sha256:hash,bytes:Buffer.byteLength(data),
   retrievedAt:new Date().toISOString(),status:'ACQUIRED_UNVERIFIED',
   verticalDatum:'NOT_APPLICABLE_DISCHARGE',engineeringUse:'REFERENCE_ONLY_UNTIL_QA'};
 const out=path.resolve(output),metadata=path.resolve(summary),suffix='.'+randomUUID()+'.staging';
 await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.mkdir(path.dirname(metadata),{recursive:true});
 const temp=out+suffix,tempMetadata=metadata+suffix;
 try{
   await fs.writeFile(temp,data,{flag:'wx',mode:0o600});
   await fs.writeFile(tempMetadata,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
   await fs.link(temp,out);
   try{await fs.link(tempMetadata,metadata);}
   catch(error){await fs.rm(out,{force:true});throw error;}
   return receipt;
 }finally{await fs.rm(temp,{force:true});await fs.rm(tempMetadata,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
   const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
     if(!/^--(site|start|end|output|summary)=/.test(arg))throw Error('invalid CLI option');
     const i=arg.indexOf('=');return [arg.slice(2,i),arg.slice(i+1)];
   }));
   const receipt=await writeDailySnapshot({...args,apiKey:process.env.USGS_API_KEY});
   console.log(JSON.stringify({status:receipt.status,sourceUrl:receipt.sourceUrl,
     sha256:receipt.sha256,observationCount:receipt.observationCount}));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
