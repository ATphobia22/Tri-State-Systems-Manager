import test from 'node:test';
import assert from 'node:assert/strict';
import { NoaaAdapter } from '../../packages/government/src/adapters/NoaaAdapter.ts';
import { validateEvidenceEnvelope } from '../../packages/government/src/index.ts';
import { GovernmentSourceCapabilityProvider } from '../../packages/government/src/GovernmentSourceCapabilityProvider.ts';

const point={properties:{forecast:'https://api.weather.gov/gridpoints/PAH/11,22/forecast'}};
const data={properties:{updated:'2026-11-09T04:00:00Z',validTimes:'2026-11-09T04:00:00Z/P7D',
 periods:[{number:1,name:'Tonight',startTime:'2026-11-09T18:00:00-06:00',endTime:'2026-11-10T06:00:00-06:00',temperature:42,temperatureUnit:'F',shortForecast:'Cloudy'}]}};
function mock(responsePoint:unknown=point){
 const calls:Array<{url:string;headers:Record<string,string>}>=[];
 const fetcher=async(url:RequestInfo|URL,init?:RequestInit)=>{
  const uri=String(url);
  calls.push({url:uri,headers:(init?.headers??{}) as Record<string,string>});
  const body=uri.includes('/points/')?responsePoint:uri.includes('/gridpoints/')?data:null;
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/geo+json'}});
 };
 return {calls,fetcher:fetcher as typeof fetch};
}
test('NWS point discovery follows same-host WFO grid URL and records both network artifacts',async()=>{
 const {calls,fetcher}=mock();
 const envelope=await new NoaaAdapter().getPointForecast(37.93,-87.90,{fetcher});
 assert.equal(envelope.result.classification,'FORECAST');
 assert.equal(envelope.result.issueTime,'2026-11-09T04:00:00Z');
 assert.equal(envelope.result.periods.length,1);
 assert.equal(envelope.evidence.length,2);
 assert.equal(calls.length,2);
 assert.equal(calls[1].url,point.properties.forecast);
 assert.match(calls[0].headers['user-agent'],/Tri-State-Systems-Manager/);
 assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
});
test('NWS point discovery rejects off-agency forecast URLs',async()=>{
 const {calls,fetcher}=mock({properties:{forecast:'https://attacker.example/gridpoints/PAH/11,22/forecast'}});
 await assert.rejects(new NoaaAdapter().getPointForecast(37.93,-87.90,{fetcher}),/NWS_FORECAST_URL_INVALID/);
 assert.equal(calls.length,1);
});
test('NWS forecast rejects nonfinite coordinates',async()=>{
 await assert.rejects(new NoaaAdapter().getPointForecast(Infinity,-87.9),/NOAA_COORDINATES_INVALID/);
});
test('UACF registers the NOAA forecast action',async()=>{
 const p=new GovernmentSourceCapabilityProvider();
 assert.equal((await p.supports('source.lookup',{sourceId:'noaa.weather',action:'forecast'})).supported,true);
});
