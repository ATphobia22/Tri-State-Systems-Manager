import { randomUUID } from 'node:crypto';
import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ExecutionEvent, ProviderHealth } from '../../contracts/src/index.ts';
import { GOVERNMENT_SOURCES as SOURCE_REGISTRY, getRegisteredGovernmentSource } from './GovernmentSourceRegistry.ts';
import { GOVERNMENT_SOURCES as REST_SOURCES, queryGovernmentJson, sha256 } from './index.ts';
import { DatasetValidator } from './validators/DatasetValidator.ts';
import { SsurgoAdapter } from './adapters/SsurgoAdapter.ts';
import { FemaMapChangeAdapter } from './adapters/FemaMapChangeAdapter.ts';
import { EchoAdapter } from './adapters/EchoAdapter.ts';
import { NldAdapter } from './adapters/NldAdapter.ts';
import { TigerwebAdapter } from './adapters/TigerwebAdapter.ts';
import type { GovernmentDataset } from './types/GovernmentDataset.ts';

const definitions:readonly CapabilityDefinition[]=[
 {id:'source.lookup',name:'Specialized government lookup',description:'Bounded typed read-only lookup through government agency adapters.',version:'1.0.0',inputSchema:{type:'object',required:['sourceId','action'],properties:{sourceId:{type:'string'},action:{type:'string'}}},outputSchema:{type:'object',required:['result','citations','evidence','provenance','hashes']},permissions:['tsm:government-data'],tags:['government','agency','live','evidence']},
 {id:'source.fetch',name:'Fetch government source',description:'Fetch a bounded JSON response from an allowlisted government REST source with evidence hashes.',version:'1.0.0',inputSchema:{type:'object',required:['sourceId','url'],properties:{sourceId:{type:'string'},url:{type:'string',format:'uri'}}},outputSchema:{type:'object',required:['result','citations','evidence','provenance','hashes']},permissions:['tsm:government-data'],tags:['government','source','evidence']},
 {id:'source.validate',name:'Validate government dataset metadata',description:'Validate required metadata, SHA-256 format, retrieval timestamp, feature count, and supported geometry type.',version:'1.0.0',inputSchema:{type:'object',required:['dataset'],properties:{dataset:{type:'object'}}},outputSchema:{type:'object',required:['valid','errors']},permissions:['tsm:government-data'],tags:['government','validation']},
 {id:'source.hash',name:'Hash government evidence',description:'Create a deterministic SHA-256 hash of a canonical JSON value.',version:'1.0.0',inputSchema:{type:'object',required:['value'],properties:{value:{}}},outputSchema:{type:'object',required:['sha256']},permissions:['tsm:government-data'],tags:['government','hash']},
 {id:'source.register',name:'Resolve registered government source',description:'Resolve a source in the checked-in registry. This does not persist a database row.',version:'1.0.0',inputSchema:{type:'object',required:['sourceId'],properties:{sourceId:{type:'string'}}},outputSchema:{type:'object',required:['source']},permissions:['tsm:government-data'],tags:['government','registry']}
] as const;
const idAliases:Readonly<Record<string,string>>={'fema.nfhl':'fema-nfhl','usgs.3dep':'usgs-3dep','usgs.nhd':'usgs-nhd','usgs.3dhp':'usgs-hydrography','noaa.tides':'noaa-coops','noaa.weather':'noaa-weather','census.places':'census-tiger','census.tiger':'census-tigerweb','usda.ssurgo':'usda-soils','noaa.nwps':'noaa-nwps','usgs.nwis':'usgs-nwis','usgs.waterdata-ogc':'usgs-waterdata-ogc','usgs.3dhp-edh':'usgs-3dhp','noaa.fim':'nws-flood-inundation','nasa.power-ag':'nasa-power-ag','epa.facilities':'epa-facilities','usgs.publications':'usgs-publications','usgs.topoview':'usgs-tnm','usgs.us-topo':'usgs-tnm','usgs.orthoimagery':'usgs-tnm','army-corps.levees':'usace-levees'};
function objectInput(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('SOURCE_INPUT_MUST_BE_OBJECT');return value as Record<string,unknown>;}
export class GovernmentSourceCapabilityProvider implements CapabilityProvider {
 readonly id='government-source-fabric';readonly version='1.0.0';readonly capabilities=definitions;
 async health():Promise<ProviderHealth>{return{healthy:true,lastChecked:new Date().toISOString()};}
 async supports(capability:CapabilityId,input:unknown){const definition=definitions.find(x=>x.id===capability);if(!definition)return{supported:false,reason:'Capability is not implemented; source.ingest and source.publish require durable storage adapters.'};try{const value=objectInput(input);if(capability==='source.lookup'){
   if(typeof value.sourceId!=='string'||typeof value.action!=='string')throw new Error('SOURCE_LOOKUP_ARGUMENTS_REQUIRED');
   if(!['usda.ssurgo:point','fema.loma:discover','fema.lomr:discover','fema.loma:case','fema.lomr:case','epa.facilities:zip','army-corps.levees:metadata','census.tiger:metadata'].includes(value.sourceId+':'+value.action))throw new Error('SOURCE_LOOKUP_UNSUPPORTED');
  }else if(capability==='source.fetch'){if(typeof value.sourceId!=='string'||typeof value.url!=='string')throw new Error('SOURCE_ID_AND_URL_REQUIRED');const source=getRegisteredGovernmentSource(value.sourceId);if(source.access!=='REST_JSON')throw new Error('SOURCE_REQUIRES_SPECIALIZED_DOWNLOAD_OR_CATALOG_ADAPTER');const alias=idAliases[source.id];if(!alias||!REST_SOURCES.some(s=>s.id===alias))throw new Error('SOURCE_REST_ADAPTER_NOT_CONFIGURED');}else if(capability==='source.validate'){if(!value.dataset||typeof value.dataset!=='object'||Array.isArray(value.dataset))throw new Error('DATASET_REQUIRED');}else if(capability==='source.hash'){if(!('value' in value))throw new Error('HASH_VALUE_REQUIRED');}else if(capability==='source.register'){if(typeof value.sourceId!=='string')throw new Error('SOURCE_ID_REQUIRED');getRegisteredGovernmentSource(value.sourceId);}return{supported:true};}catch(error){return{supported:false,reason:error instanceof Error?error.message:'Invalid source capability input'};}}
 async execute(request:CapabilityRequest):Promise<CapabilityResult>{const traceId=request.context.requestId||randomUUID(),startedAt=new Date().toISOString(),events:ExecutionEvent[]=[{type:'capability.started',traceId,timestamp:startedAt,capability:request.capability}];try{
  const input=objectInput(request.input);let output:unknown;
  if(request.capability==='source.lookup'){
   const sourceId=String(input.sourceId??''),action=String(input.action??'');
   const key=sourceId+':'+action;
   if(key==='usda.ssurgo:point')output=await new SsurgoAdapter().lookupPoint(Number(input.latitude),Number(input.longitude));
   else if(key==='fema.loma:discover'||key==='fema.lomr:discover')output=await new FemaMapChangeAdapter().discover(sourceId==='fema.loma'?'LOMA':'LOMR');
   else if(key==='fema.loma:case'||key==='fema.lomr:case')output=await new FemaMapChangeAdapter().queryCase(sourceId==='fema.loma'?'LOMA':'LOMR',Number(input.layerId),String(input.field??''),String(input.value??''));
   else if(key==='epa.facilities:zip')output=await new EchoAdapter().getFacilitiesByZip(String(input.zip??''));
   else if(key==='army-corps.levees:metadata')output=await new NldAdapter().getServiceMetadata();
   else if(key==='census.tiger:metadata')output=await new TigerwebAdapter().getServiceMetadata(String(input.service??'State_County'));
   else throw new Error('SOURCE_LOOKUP_UNSUPPORTED');
  }else if(request.capability==='source.fetch'){
   if(typeof input.sourceId!=='string'||typeof input.url!=='string')throw new Error('SOURCE_ID_AND_URL_REQUIRED');
   const source=getRegisteredGovernmentSource(input.sourceId);if(source.access!=='REST_JSON')throw new Error('SOURCE_REQUIRES_SPECIALIZED_DOWNLOAD_OR_CATALOG_ADAPTER');
   const alias=idAliases[source.id];if(!alias||!REST_SOURCES.some(s=>s.id===alias))throw new Error('SOURCE_REST_ADAPTER_NOT_CONFIGURED');
   output=await queryGovernmentJson(alias,input.url,{timeoutMs:20000});
  }else if(request.capability==='source.validate'){
   const dataset=input.dataset as GovernmentDataset;const errors=new DatasetValidator().validate(dataset);output={valid:errors.length===0,errors,sourceId:dataset.sourceId,checksum:dataset.checksum};
  }else if(request.capability==='source.hash'){
   if(!('value' in input))throw new Error('HASH_VALUE_REQUIRED');output={sha256:sha256(input.value)};
  }else if(request.capability==='source.register'){
   if(typeof input.sourceId!=='string')throw new Error('SOURCE_ID_REQUIRED');output={source:getRegisteredGovernmentSource(input.sourceId),registryCount:SOURCE_REGISTRY.length,persisted:false};
  }else throw new Error('GOVERNMENT_SOURCE_CAPABILITY_NOT_IMPLEMENTED');
  events.push({type:'capability.completed',traceId,timestamp:new Date().toISOString(),capability:request.capability});
  const hash=sha256(output);const resultOutput=output&&typeof output==='object'?{...(output as Record<string,unknown>),traceId,hash}:output;
  const sourceResult=output as {citations?:Array<{url:string;title?:string;retrievedAt:string}>;hashes?:{input:string;output:string};provenance?:{traceId:string;provider:string;providerVersion:string;generatedAt:string;inputHash:string;outputHash:string;status:string}};
  return{success:true,output:resultOutput,provenance:[{sourceType:'provider',sourceId:String(input.sourceId??request.capability),provider:this.id,version:this.version,timestamp:new Date().toISOString(),inputHash:sourceResult?.hashes?.input??sha256(request.input),outputHash:sourceResult?.hashes?.output??hash,parentTraceId:traceId}],citations:(sourceResult?.citations??[]).map((c,i)=>({id:'government-source-'+i,url:c.url,title:c.title,retrievedAt:c.retrievedAt})),usage:{},events,provider:{providerId:this.id,version:this.version,attempt:1,startedAt,completedAt:new Date().toISOString()},traceId};
 }catch(error){const message=error instanceof Error?error.message:'Government source capability failed';events.push({type:'capability.failed',traceId,timestamp:new Date().toISOString(),capability:request.capability,reason:message});return{success:false,error:{code:message.includes('HTTP_')?'PROVIDER_UNAVAILABLE':'INVALID_INPUT',message,retryable:message.includes('HTTP_')||message.includes('timeout'),traceId},provenance:[],citations:[],usage:{},events,provider:{providerId:this.id,version:this.version,attempt:1,startedAt,completedAt:new Date().toISOString()},traceId};}}
}
