import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface NasaPowerAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

export interface NasaPowerParameterSeries {
 readonly code:string;
 readonly units:string|null;
 readonly longname:string|null;
 /** One entry per requested date; value is null where NASA reports its -999 fill value or a non-finite value. */
 readonly values:readonly {date:string; value:number|null}[];
}

export interface NasaPowerUnavailable {
 readonly reason:string;
}

export interface NasaPowerDailyResult {
 readonly latitude:number;
 readonly longitude:number;
 /** Ground elevation (m) reported by NASA POWER for the grid cell, or null when absent. */
 readonly elevation:number|null;
 readonly start:string;
 readonly end:string;
 readonly community:string;
 readonly timeStandard:string|null;
 readonly sources:readonly string[];
 readonly parameters:readonly NasaPowerParameterSeries[];
 readonly queryUrl:string;
 readonly unavailable:readonly NasaPowerUnavailable[];
}

const DATE_RE=/^\d{8}$/;
const PARAMETER_RE=/^[A-Z0-9_]+$/;
const COMMUNITY_RE=/^[A-Z]+$/;
/** NASA POWER fill value for missing daily data — never a real measurement. */
const FILL_VALUE=-999;

function isValidCalendarDate(value:string):boolean {
 const year=Number(value.slice(0,4));
 const month=Number(value.slice(4,6));
 const day=Number(value.slice(6,8));
 if(month<1||month>12||day<1||day>31)return false;
 const parsed=new Date(Date.UTC(year,month-1,day));
 return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day;
}

function parseDailyPoint(payload:unknown,requested:string[],latitude:number,longitude:number,start:string,end:string,community:string,queryUrl:string):NasaPowerDailyResult|null {
 const root=(payload as Record<string,unknown>|null|undefined);
 if(!root||typeof root!=='object'||Array.isArray(root))return null;
 const properties=root['properties'] as Record<string,unknown>|undefined;
 if(!properties||typeof properties!=='object'||Array.isArray(properties))return null;
 const parameterBlock=properties['parameter'] as Record<string,Record<string,unknown>>|undefined;
 if(!parameterBlock||typeof parameterBlock!=='object'||Array.isArray(parameterBlock))return null;
 const header=properties['header'] as Record<string,unknown>|undefined;
 const parameterMeta=properties['parameters'] as Record<string,Record<string,unknown>>|undefined;
 const geometry=root['geometry'] as Record<string,unknown>|undefined;
 const coordinates=Array.isArray(geometry?.['coordinates'])?geometry['coordinates'] as unknown[]:[];
 const elevation=typeof coordinates[2]==='number'&&Number.isFinite(coordinates[2])?coordinates[2]:null;
 const series:NasaPowerParameterSeries[]=[];
 for(const code of requested){
  const daily=parameterBlock[code];
  if(!daily||typeof daily!=='object'||Array.isArray(daily))return null;
  const meta=parameterMeta?.[code];
  const values=Object.keys(daily).sort().map(date=>{
   const raw=daily[date];
   const value=typeof raw==='number'&&Number.isFinite(raw)&&raw!==FILL_VALUE?raw:null;
   return {date,value};
  });
  series.push({
   code,
   units:typeof meta?.['units']==='string'?meta['units']:null,
   longname:typeof meta?.['longname']==='string'?meta['longname']:null,
   values,
  });
 }
 return {
  latitude,longitude,elevation,start,end,community,
  timeStandard:typeof header?.['time_standard']==='string'?header['time_standard']:null,
  sources:Array.isArray(header?.['sources'])?(header['sources'] as unknown[]).filter((s):s is string=>typeof s==='string'):[],
  parameters:series,queryUrl,unavailable:[],
 };
}

function buildEnvelope(result:NasaPowerDailyResult,evidence:EvidenceEnvelope<unknown>['evidence'],citations:EvidenceEnvelope<unknown>['citations'],status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<NasaPowerDailyResult> {
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId:'nasa-power-ag',queryUrl:result.queryUrl});
 return {
  result,traceId,hash:outputHash,citations,evidence,
  provenance:{traceId,provider:'nasa-power-ag',providerVersion:'1',generatedAt,inputHash,outputHash,status},
  hashes:{input:inputHash,output:outputHash},
 };
}

/**
 * NASA POWER daily agroclimatology (sourceId 'nasa-power-ag').
 *
 * Live method — on-demand fetch only, no polling, no background refresh.
 * Grid-cell reanalysis / near-real-time values are not on-farm station
 * measurements; time standard, units, sources and the -999 fill value are
 * preserved in the result. Transport or shape failures are reported as an
 * honest UNAVAILABLE envelope — never fabricated, never fail-closed.
 */
export class NasaPowerAdapter {
 readonly sourceId='nasa-power-ag';
 readonly endpoint='https://power.larc.nasa.gov/api/temporal/daily';

 async getDailyPoint(input:{latitude:number;longitude:number;start:string;end:string;parameters:string[];community?:string},options:NasaPowerAdapterOptions={}):Promise<EvidenceEnvelope<NasaPowerDailyResult>> {
  const {latitude,longitude,start,end,parameters}=input;
  const community=input.community??'AG';
  if(typeof latitude!=='number'||!Number.isFinite(latitude)||latitude<-90||latitude>90)throw new Error('NASA_LATITUDE_INVALID:'+String(latitude));
  if(typeof longitude!=='number'||!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new Error('NASA_LONGITUDE_INVALID:'+String(longitude));
  if(typeof start!=='string'||!DATE_RE.test(start)||!isValidCalendarDate(start))throw new Error('NASA_DATE_INVALID:'+String(start));
  if(typeof end!=='string'||!DATE_RE.test(end)||!isValidCalendarDate(end))throw new Error('NASA_DATE_INVALID:'+String(end));
  if(start>end)throw new Error('NASA_DATE_RANGE_INVALID:'+start+'>'+end);
  if(!Array.isArray(parameters)||parameters.length===0||parameters.length>15)throw new Error('NASA_PARAMETERS_INVALID:expected 1-15 parameter codes');
  for(const code of parameters)if(typeof code!=='string'||!PARAMETER_RE.test(code))throw new Error('NASA_PARAMETER_INVALID:'+String(code));
  if(!COMMUNITY_RE.test(community))throw new Error('NASA_COMMUNITY_INVALID:'+String(community));

  const url=new URL(this.endpoint+'/point');
  url.searchParams.set('parameters',parameters.join(','));
  url.searchParams.set('community',community);
  url.searchParams.set('longitude',String(longitude));
  url.searchParams.set('latitude',String(latitude));
  url.searchParams.set('start',start);
  url.searchParams.set('end',end);
  url.searchParams.set('format','JSON');
  const queryUrl=url.toString();
  const retrievedAt=new Date().toISOString();
  const failureResult=(reason:string):NasaPowerDailyResult=>({latitude,longitude,elevation:null,start,end,community,timeStandard:null,sources:[],parameters:[],queryUrl,unavailable:[{reason}]});
  const failureEvidence=(reason:string):EvidenceEnvelope<unknown>['evidence']=>[{sourceId:this.sourceId,authority:'NASA',retrievedAt,sha256:sha256({queryUrl,reason}),mediaType:'application/json'}];
  const citations:EvidenceEnvelope<unknown>['citations']=[{url:queryUrl,title:'NASA POWER daily agroclimatology (attempted)',retrievedAt}];
  let envelope:EvidenceEnvelope<unknown>;
  try {
   envelope=await queryGovernmentJson<unknown>(this.sourceId,queryUrl,options);
  } catch(error){
   const reason='fetch failed: '+(error instanceof Error?error.message:String(error));
   return buildEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  const parsed=parseDailyPoint(envelope.result,parameters,latitude,longitude,start,end,community,queryUrl);
  if(!parsed){
   const reason='response did not contain the expected NASA POWER properties.parameter daily series';
   return buildEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  return buildEnvelope(parsed,envelope.evidence,envelope.citations,'UNVERIFIED');
 }
}
