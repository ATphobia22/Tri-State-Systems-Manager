import test from "node:test";
import assert from "node:assert/strict";
import { GovernmentFabric, GOVERNMENT_SOURCES } from "../../packages/government/src/index.mjs";

const userAgent="TSM-SOS (https://github.com/ATphobia22/Tri-State-Systems-Manager)";
const response=(body)=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(body)).buffer});
test("NWS forecast is two-step, provenance-backed and cannot be regulatory",async()=>{
 const urls=[];
 const fetchImpl=async(url)=>{urls.push(url);return response(url.includes("/points/")?{properties:{forecast:"https://api.weather.gov/gridpoints/PAH/10,20/forecast"}}:{properties:{periods:[]}})};
 const f=new GovernmentFabric({userAgent,fetchImpl,now:()=>new Date("2026-11-09T00:00:00Z")});
 const result=await f.getForecast(37.9,-87.9);
 assert.equal(urls.length,2);
 assert.equal(result.classification,"DERIVED");
 assert.equal(result.dependencies.length,1);
 assert.equal(result.regulatoryUse,false);
 assert.match(result.evidence.responseHash,/^[a-f0-9]{64}$/);
});
test("NWS disallows foreign forecast URLs",async()=>{
 const f=new GovernmentFabric({userAgent,fetchImpl:async()=>response({properties:{forecast:"https://attacker.invalid/forecast"}})});
 await assert.rejects(f.getForecast(37,-87),/Untrusted agency endpoint/);
});
test("station, bbox and state parameters validated",async()=>{
 const f=new GovernmentFabric({userAgent,fetchImpl:async()=>{throw Error("network must not run")}});
 assert.throws(()=>f.getAlerts("IN&x=1"),/state/);
 assert.throws(()=>f.getLatestObservation("../secrets"),/station/);
 assert.throws(()=>f.searchElevationProducts("1,2,0,3"),/bbox/);
});
test("source catalog contains key authoritative datasets",()=>{
 assert.equal(GOVERNMENT_SOURCES.FEMA.NFHL,"fema.nfhl");
 assert.equal(GOVERNMENT_SOURCES.USGS.DEM_3DEP,"usgs.3dep");
});
