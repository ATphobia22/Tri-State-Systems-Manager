import test from 'node:test';
import assert from 'node:assert/strict';
import { SsurgoAdapter } from '../../packages/government/src/adapters/SsurgoAdapter.ts';
import { FemaMapChangeAdapter } from '../../packages/government/src/adapters/FemaMapChangeAdapter.ts';
import { validateEvidenceEnvelope } from '../../packages/government/src/index.ts';
import { GovernmentSourceCapabilityProvider } from '../../packages/government/src/GovernmentSourceCapabilityProvider.ts';

test('SSURGO point uses fixed SQL and produces canonical UACF evidence',async()=>{
 let body='';
 const fetcher=async(_url:unknown,init?:RequestInit)=>{
  body=String(init?.body??'');
  return new Response(JSON.stringify({Table:[['1234567']]}),{status:200,headers:{'content-type':'application/json'}});
 };
 const result=await new SsurgoAdapter().lookupPoint(37.9,-87.9,{fetcher:fetcher as typeof fetch});
 assert.deepEqual(result.result.mukeys,['1234567']);
 assert.match(body,/SDA_Get_Mukey_from_intersection_with_WktWgs84/);
 assert.deepEqual(validateEvidenceEnvelope(result),[]);
});
test('SSURGO rejects nonfinite point without fetching',async()=>{
 await assert.rejects(new SsurgoAdapter().lookupPoint(NaN,-87),/SSURGO_POINT_INVALID/);
});
test('FEMA change discovery filters correct named layers and validates its envelope',async()=>{
 const fetcher=async()=>new Response(JSON.stringify({layers:[{id:1,name:'Letters of Map Revision'},{id:2,name:'Flood Hazard Zones'}]}),{status:200,headers:{'content-type':'application/json'}});
 const found=await new FemaMapChangeAdapter().discover('LOMR',{fetcher:fetcher as typeof fetch});
 assert.deepEqual(found.result.matches,[{id:1,name:'Letters of Map Revision'}]);
 assert.deepEqual(validateEvidenceEnvelope(found),[]);
});
test('canonical provider exposes supported bounded source.lookups',async()=>{
 const p=new GovernmentSourceCapabilityProvider();
 assert.equal((await p.supports('source.lookup',{sourceId:'usda.ssurgo',action:'point'})).supported,true);
 assert.equal((await p.supports('source.lookup',{sourceId:'fema.loma',action:'case'})).supported,true);
 assert.equal((await p.supports('source.lookup',{sourceId:'unknown',action:'anything'})).supported,false);
});
