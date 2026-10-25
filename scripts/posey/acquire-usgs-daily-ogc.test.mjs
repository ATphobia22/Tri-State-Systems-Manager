import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildDailyUrl,fetchDailyMeanDischarge,writeDailySnapshot} from './acquire-usgs-daily-ogc.mjs';
const args={site:'03378500',start:'2026-10-01',end:'2026-10-03'};
const point=(date,value,extra={})=>({type:'Feature',properties:{monitoring_location_id:'USGS-03378500',
 parameter_code:'00060',statistic_id:'00003',time:date,unit_of_measure:'ft^3/s',value:String(value),timeseries_id:'one',approvals_status:['Approved'],...extra}});
const reply=(features,next)=>new Response(JSON.stringify({type:'FeatureCollection',features,links:next?[{rel:'next',href:next}]:[]}),{status:200,headers:{'content-type':'application/geo+json'}});
test('modern OGC daily query binds exact site, statistic, variable and UTC date range',()=>{
 const u=buildDailyUrl(args);
 assert.equal(u.pathname,'/ogcapi/v1/collections/daily/items');
 assert.equal(u.searchParams.get('monitoring_location_id'),'USGS-03378500');
 assert.equal(u.searchParams.get('parameter_code'),'00060');
 assert.equal(u.searchParams.get('statistic_id'),'00003');
 assert.equal(u.searchParams.get('datetime'),'2026-10-01/2026-10-03');
 assert.throws(()=>buildDailyUrl({...args,site:'wrong'}),/eight digits/);
});
test('two source pages preserve provenance and USGS reported approval quality',async()=>{
 const url=buildDailyUrl(args);const page2=new URL(url);page2.searchParams.set('offset','1');
 let calls=0;
 const result=await fetchDailyMeanDischarge({...args,fetcher:async u=>{
   calls++;
   return String(u).includes('offset=1')?reply([point('2026-10-02',200)]):reply([point('2026-10-01',100)],page2.href);
 }});
 assert.equal(calls,2);assert.equal(result.rows.length,2);
 assert.equal(result.rows[0].discharge_cfs,100);
 assert.deepEqual(result.rows[0].approvals_status,['Approved']);
 assert.match(result.pages[0].sha256,/^[a-f0-9]{64}$/);
});
test('rejects wrong station, units and negative discharge',async()=>{
 for(const [extra,error] of [
  [{monitoring_location_id:'USGS-00000001'},/wrong station/],
  [{unit_of_measure:'m^3/s'},/unexpected units/],
  [{value:'-999'},/nonnegative/]
 ]){
  await assert.rejects(fetchDailyMeanDischarge({...args,fetcher:async()=>reply([point('2026-10-01',100,extra)])}),error);
 }
});
test('rejects malicious paging, zero observations and invalid HTTP responses',async()=>{
 await assert.rejects(fetchDailyMeanDischarge({...args,fetcher:async()=>reply([point('2026-10-01',1)],'https://evil.test/next')}),/left trusted collection/);
 await assert.rejects(fetchDailyMeanDischarge({...args,fetcher:async()=>reply([])}),/no daily mean discharge/);
 await assert.rejects(fetchDailyMeanDischarge({...args,fetcher:async()=>new Response('no',{status:503})}),/HTTP 503/);
});
test('immutable snapshots carry byte-matched hashes and do not overwrite existing artifacts',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'tsm-daily-'));
 try{
  const output=path.join(dir,'daily.ndjson'),summary=path.join(dir,'daily-receipt.json');
  const opts={...args,output,summary,fetcher:async()=>reply([point('2026-10-01',100)])};
  const receipt=await writeDailySnapshot(opts);
  assert.equal(receipt.status,'ACQUIRED_UNVERIFIED');
  assert.equal(receipt.sha256,createHash('sha256').update(readFileSync(output)).digest('hex'));
  assert.equal(JSON.parse(readFileSync(summary,'utf8')).observationCount,1);
  await assert.rejects(writeDailySnapshot(opts),/EEXIST/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('incomplete pair publication rolls back new data file',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'tsm-daily-'));
 try{
  const output=path.join(dir,'daily.ndjson'),summary=path.join(dir,'daily-receipt.json');
  writeFileSync(summary,'occupied');
  await assert.rejects(writeDailySnapshot({...args,output,summary,fetcher:async()=>reply([point('2026-10-01',100)])}),/EEXIST/);
  assert.equal(existsSync(output),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
