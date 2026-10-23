import { randomUUID } from 'node:crypto';
import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ExecutionEvent, ProviderHealth } from '../../contracts/src/index.ts';
import { queryGovernmentJson } from './index.ts';

interface NfhlQueryInput { layerId:number; where?:string; outFields?:string[]; returnGeometry?:boolean; resultRecordCount?:number }
const definition:CapabilityDefinition={id:'geo.nfhl.query',name:'FEMA NFHL query',description:'Read-only query against a registered FEMA NFHL layer with source hashes and provenance.',version:'1.0.0',inputSchema:{type:'object',required:['layerId'],properties:{layerId:{type:'integer',minimum:0,maximum:34},where:{type:'string',maxLength:512},outFields:{type:'array',items:{type:'string',pattern:'^[A-Za-z_][A-Za-z0-9_]*$'},maxItems:100},returnGeometry:{type:'boolean'},resultRecordCount:{type:'integer',minimum:1,maximum:1000}}},outputSchema:{type:'object',required:['result','citations','evidence','provenance','hashes']},permissions:['tsm:geospatial'],tags:['government','fema','nfhl','evidence']};
const validLayerIds=new Set([0,1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,22,23,24,25,26,27,28,29,30,31,32,34]);
function parseInput(value:unknown):NfhlQueryInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('NFHL_INPUT_MUST_BE_OBJECT');
 const input=value as Record<string,unknown>;
 if(!Number.isInteger(input.layerId)||!validLayerIds.has(input.layerId as number))throw new Error('NFHL_LAYER_ID_NOT_REGISTERED');
 const where=input.where??'1=1';
 if(typeof where!=='string'||where.length>512||/[;]|--|\/\*|\*\//.test(where))throw new Error('NFHL_WHERE_INVALID');
 if(input.outFields!==undefined&&(!Array.isArray(input.outFields)||input.outFields.length>100||input.outFields.some(f=>typeof f!=='string'||! /^[A-Za-z_][A-Za-z0-9_]*$/.test(f))))throw new Error('NFHL_OUT_FIELDS_INVALID');
 if(input.returnGeometry!==undefined&&typeof input.returnGeometry!=='boolean')throw new Error('NFHL_RETURN_GEOMETRY_INVALID');
 const count=input.resultRecordCount??100;
 if(!Number.isInteger(count)||Number(count)<1||Number(count)>1000)throw new Error('NFHL_RECORD_COUNT_OUT_OF_RANGE');
 return {layerId:input.layerId as number,where,outFields:(input.outFields as string[]|undefined)??['*'],returnGeometry:input.returnGeometry===true,resultRecordCount:Number(count)};
}
export class GovernmentDataProvider implements CapabilityProvider {
 readonly id='government-data';readonly version='1.0.0';readonly capabilities=[definition] as const;
 async health():Promise<ProviderHealth>{const lastChecked=new Date().toISOString();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),3000);try{const response=await fetch('https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson',{signal:controller.signal,headers:{accept:'application/json'}});if(!response.ok)return{healthy:false,lastChecked};const body=await response.json() as {layers?:unknown};return{healthy:Array.isArray(body.layers)&&body.layers.length>0,lastChecked};}catch{return{healthy:false,lastChecked};}finally{clearTimeout(timer);}}
 async supports(capability:CapabilityId,input:unknown){if(capability!=='geo.nfhl.query')return{supported:false,reason:'Capability is not implemented by this provider.'};try{parseInput(input);return{supported:true};}catch(error){return{supported:false,reason:error instanceof Error?error.message:'Invalid NFHL query'};}}
 async execute(request:CapabilityRequest):Promise<CapabilityResult>{
  const traceId=request.context.requestId||randomUUID(),startedAt=new Date().toISOString(),events:ExecutionEvent[]=[{type:'capability.started',traceId,timestamp:startedAt,capability:request.capability}];
  try{
   if(request.capability!=='geo.nfhl.query')throw new Error('GOVERNMENT_CAPABILITY_NOT_IMPLEMENTED');
   const input=parseInput(request.input);
   const url=new URL('https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/'+input.layerId+'/query');
   url.searchParams.set('where',input.where??'1=1');url.searchParams.set('outFields',(input.outFields??['*']).join(','));url.searchParams.set('returnGeometry',String(input.returnGeometry===true));url.searchParams.set('resultRecordCount',String(input.resultRecordCount??100));url.searchParams.set('f','json');
   const output=await queryGovernmentJson('fema-nfhl',url.toString(),{timeoutMs:20000});
   if(output.result&&typeof output.result==='object'&&'error' in (output.result as Record<string,unknown>))throw new Error('FEMA_NFHL_QUERY_REJECTED');
   events.push({type:'capability.completed',traceId,timestamp:new Date().toISOString(),capability:request.capability});
   return{success:true,output,provenance:[{sourceType:'api',sourceId:'fema-nfhl',provider:this.id,version:this.version,timestamp:new Date().toISOString(),inputHash:output.hashes.input,outputHash:output.hashes.output,parentTraceId:traceId}],citations:output.citations.map((c,i)=>({id:'fema-nfhl-'+i,url:c.url,title:c.title,retrievedAt:c.retrievedAt})),usage:{},events,provider:{providerId:this.id,version:this.version,attempt:1,startedAt,completedAt:new Date().toISOString()},traceId};
  }catch(error){const message=error instanceof Error?error.message:'Government data provider failed';const unavailable=/^GOVERNMENT_SOURCE_HTTP_(429|5\d\d)$/.test(message)||/timeout|fetch failed|network|aborted/i.test(message);events.push({type:'capability.failed',traceId,timestamp:new Date().toISOString(),capability:request.capability,reason:message});return{success:false,error:{code:unavailable?'PROVIDER_UNAVAILABLE':'INVALID_INPUT',message,retryable:unavailable,traceId},provenance:[],citations:[],usage:{},events,provider:{providerId:this.id,version:this.version,attempt:1,startedAt,completedAt:new Date().toISOString()},traceId};}
 }
}
