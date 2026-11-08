import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface CoopsAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

/**
 * CO-OPS vertical datums verified live 2026-11-07 against station 8638610
 * (each returned HTTP 200 with a metadata + data block): MHHW, MHW, MTL,
 * MSL, MLW, MLLW, NAVD, LWI, HWI, STND. NOTE: "NAVD88" is NOT a CO-OPS
 * datum — the live API rejects it with HTTP 400 ("The supported Datum
 * values are: MHHW, MHW, MTL, MSL, MLW, MLLW, NAVD, LWI, HWI"); the
 * NAVD88-equivalent datum here is "NAVD". Do not add NAVD88.
 */
export type CoopsDatum='MHHW'|'MHW'|'MTL'|'MSL'|'MLW'|'MLLW'|'NAVD'|'LWI'|'HWI'|'STND';
export const COOPS_DATUMS:readonly CoopsDatum[]=['MHHW','MHW','MTL','MSL','MLW','MLLW','NAVD','LWI','HWI','STND'];
export type CoopsUnits='english'|'metric';
export type CoopsTimeZone='gmt'|'lst'|'lst_ldt';

export interface CoopsStationMetadata {
 readonly id:string;
 readonly name:string;
 readonly latitude:number;
 readonly longitude:number;
}

export interface CoopsWaterLevelObservation {
 readonly stationId:string;
 readonly observedAt:string;
 readonly value:number;
 /** Sigma (standard deviation) as reported, when present. */
 readonly sigma:number|null;
 readonly flags:string|null;
 readonly quality:string|null;
}

export interface CoopsUnavailable {
 readonly station:string;
 readonly reason:string;
}

export interface CoopsWaterLevelResult {
 readonly station:string;
 readonly datum:CoopsDatum;
 readonly units:CoopsUnits;
 readonly timeZone:CoopsTimeZone;
 /** Station metadata block carried by the datagetter response itself. */
 readonly metadata:CoopsStationMetadata|null;
 readonly observations:readonly CoopsWaterLevelObservation[];
 readonly unavailable:readonly CoopsUnavailable[];
 readonly queryUrl:string;
}

export interface CoopsPrediction {
 readonly stationId:string;
 readonly predictedAt:string;
 readonly value:number;
}

export interface CoopsPredictionResult {
 readonly station:string;
 readonly datum:CoopsDatum;
 readonly units:CoopsUnits;
 readonly timeZone:CoopsTimeZone;
 /** The predictions product carries no metadata block — only predictions. */
 readonly predictions:readonly CoopsPrediction[];
 readonly unavailable:readonly CoopsUnavailable[];
 readonly queryUrl:string;
}

const STATION_RE=/^\d{5,7}$/;
const DATE_RE=/^[A-Za-z]+$/;

function buildEnvelope<T>(sourceId:string,result:T,evidence:EvidenceEnvelope<unknown>['evidence'],citations:EvidenceEnvelope<unknown>['citations'],status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<T> {
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId,result});
 return {
  result,traceId,hash:outputHash,citations,evidence,
  provenance:{traceId,provider:sourceId,providerVersion:'1',generatedAt,inputHash,outputHash,status},
  hashes:{input:inputHash,output:outputHash},
 };
}

function parseNumber(raw:unknown):number|null {
 if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
 if(typeof raw!=='string'||!raw.trim())return null;
 const value=Number(raw.trim());
 return Number.isFinite(value)?value:null;
}

/**
 * NOAA Center for Operational Oceanographic Products and Services (CO-OPS)
 * — datagetter API only (https://api.tidesandcurrents.noaa.gov/api/prod/datagetter).
 *
 * The CO-OPS mdapi stations endpoint is deliberately NOT used: it is outside
 * the registered endpoint and queryGovernmentJson correctly rejects it. The
 * datagetter response itself carries a metadata block (station id, name,
 * lat, lon), which is used for station identity instead.
 *
 * HONEST SCOPE NOTE: no CO-OPS station exists on the Ohio River in the
 * tri-state AOI. This adapter addresses named coastal stations (e.g.
 * 8638610 Sewells Point) and is general-purpose, not tri-state water data.
 * Tri-state river levels come from the NWPS / USGS adapters instead.
 *
 * Live methods perform network fetches and are for USER-INITIATED use only
 * (no polling, no background refresh). Failures are reported as honest
 * UNAVAILABLE with a reason — never fabricated, never fail-closed.
 */
export class CoopsAdapter {
 readonly sourceId='noaa-coops';
 readonly endpoint='https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

 private checkStation(station:string):void {
  if(typeof station!=='string'||!STATION_RE.test(station))throw new Error('COOPS_STATION_INVALID:'+station);
 }
 private checkDatum(datum:CoopsDatum):void {
  if(!(COOPS_DATUMS as readonly string[]).includes(datum))throw new Error('COOPS_DATUM_INVALID:'+String(datum));
 }
 private checkUnits(units:CoopsUnits):void {
  if(units!=='english'&&units!=='metric')throw new Error('COOPS_UNITS_INVALID:'+String(units));
 }
 private checkTimeZone(timeZone:CoopsTimeZone):void {
  if(timeZone!=='gmt'&&timeZone!=='lst'&&timeZone!=='lst_ldt')throw new Error('COOPS_TIME_ZONE_INVALID:'+String(timeZone));
 }
 private checkDate(date:string):void {
  if(typeof date!=='string'||!DATE_RE.test(date))throw new Error('COOPS_DATE_INVALID:'+date);
 }

 private buildUrl(product:'water_level'|'predictions',station:string,date:string,datum:CoopsDatum,units:CoopsUnits,timeZone:CoopsTimeZone):string {
  const url=new URL(this.endpoint);
  url.searchParams.set('product',product);
  url.searchParams.set('station',station);
  url.searchParams.set('date',date);
  url.searchParams.set('datum',datum);
  url.searchParams.set('units',units);
  url.searchParams.set('time_zone',timeZone);
  url.searchParams.set('application','TSM');
  url.searchParams.set('format','json');
  return url.toString();
 }

 /**
  * Observed water levels for a CO-OPS station. `date` defaults to 'recent'
  * (the last 3 days of 6-minute data); 'today' and 'latest' are also
  * accepted by the API. Defaults: datum MLLW, units english, time zone gmt.
  */
 async getWaterLevel(args:{station:string;date?:string;datum?:CoopsDatum;units?:CoopsUnits;timeZone?:CoopsTimeZone},options:CoopsAdapterOptions={}):Promise<EvidenceEnvelope<CoopsWaterLevelResult>> {
  const station=args.station;
  const date=args.date??'recent';
  const datum=args.datum??'MLLW';
  const units=args.units??'english';
  const timeZone=args.timeZone??'gmt';
  this.checkStation(station);
  this.checkDate(date);
  this.checkDatum(datum);
  this.checkUnits(units);
  this.checkTimeZone(timeZone);
  const url=this.buildUrl('water_level',station,date,datum,units,timeZone);
  const citations:EvidenceEnvelope<unknown>['citations']=[{url,title:'NOAA CO-OPS datagetter — water_level',retrievedAt:new Date().toISOString()}];
  const fail=(reason:string):EvidenceEnvelope<CoopsWaterLevelResult>=>{
   const result:CoopsWaterLevelResult={station,datum,units,timeZone,metadata:null,observations:[],unavailable:[{station,reason}],queryUrl:url};
   return buildEnvelope(this.sourceId,result,[{sourceId:this.sourceId,authority:'NOAA',retrievedAt:new Date().toISOString(),sha256:sha256({station,reason}),mediaType:'application/json'}],citations,'UNAVAILABLE');
  };
  let envelope:EvidenceEnvelope<unknown>;
  try {
   envelope=await queryGovernmentJson(this.sourceId,url,options);
  } catch(error) {
   const reason=error instanceof Error?error.message:String(error);
   return fail('fetch failed: '+reason);
  }
  const payload=envelope.result as {metadata?:unknown;data?:unknown;error?:unknown}|null;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return fail('unexpected response shape from CO-OPS datagetter');
  if(payload.error&&typeof payload.error==='object'){
   const message=(payload.error as {message?:unknown}).message;
   return fail('CO-OPS error: '+(typeof message==='string'?message.trim():'unknown error'));
  }
  const meta=payload.metadata as {id?:unknown;name?:unknown;lat?:unknown;lon?:unknown}|undefined;
  let metadata:CoopsStationMetadata|null=null;
  if(meta&&typeof meta==='object'){
   const lat=parseNumber(meta.lat);
   const lon=parseNumber(meta.lon);
   if(typeof meta.id==='string'&&typeof meta.name==='string'&&lat!==null&&lon!==null){
    metadata={id:meta.id,name:meta.name,latitude:lat,longitude:lon};
   }
  }
  const observations:CoopsWaterLevelObservation[]=[];
  if(Array.isArray(payload.data)){
   for(const row of payload.data){
    const item=row as {t?:unknown;v?:unknown;s?:unknown;f?:unknown;q?:unknown}|null;
    if(!item||typeof item!=='object')continue;
    const value=parseNumber(item.v);
    if(value===null)continue;
    if(typeof item.t!=='string'||!item.t.trim())continue;
    observations.push({
     stationId:station,
     observedAt:item.t,
     value,
     sigma:parseNumber(item.s),
     flags:typeof item.f==='string'?item.f:null,
     quality:typeof item.q==='string'?item.q:null,
    });
   }
  }
  if(observations.length===0)return fail('no usable water-level observations for station '+station);
  if(metadata!==null&&metadata.id!==station)return fail('response metadata is for station '+metadata.id+', not requested station '+station);
  const result:CoopsWaterLevelResult={station,datum,units,timeZone,metadata,observations,unavailable:[],queryUrl:url};
  return buildEnvelope(this.sourceId,result,envelope.evidence,citations,'UNVERIFIED');
 }

 /**
  * Astronomical tide predictions for a CO-OPS station. Verified live
  * 2026-11-07: product=predictions returns HTTP 200 with a `predictions`
  * array (no metadata block). Predictions are not storm-surge forecasts.
  */
 async getPredictions(args:{station:string;date?:string;datum?:CoopsDatum;units?:CoopsUnits;timeZone?:CoopsTimeZone},options:CoopsAdapterOptions={}):Promise<EvidenceEnvelope<CoopsPredictionResult>> {
  const station=args.station;
  const date=args.date??'recent';
  const datum=args.datum??'MLLW';
  const units=args.units??'english';
  const timeZone=args.timeZone??'gmt';
  this.checkStation(station);
  this.checkDate(date);
  this.checkDatum(datum);
  this.checkUnits(units);
  this.checkTimeZone(timeZone);
  const url=this.buildUrl('predictions',station,date,datum,units,timeZone);
  const citations:EvidenceEnvelope<unknown>['citations']=[{url,title:'NOAA CO-OPS datagetter — predictions',retrievedAt:new Date().toISOString()}];
  const fail=(reason:string):EvidenceEnvelope<CoopsPredictionResult>=>{
   const result:CoopsPredictionResult={station,datum,units,timeZone,predictions:[],unavailable:[{station,reason}],queryUrl:url};
   return buildEnvelope(this.sourceId,result,[{sourceId:this.sourceId,authority:'NOAA',retrievedAt:new Date().toISOString(),sha256:sha256({station,reason}),mediaType:'application/json'}],citations,'UNAVAILABLE');
  };
  let envelope:EvidenceEnvelope<unknown>;
  try {
   envelope=await queryGovernmentJson(this.sourceId,url,options);
  } catch(error) {
   const reason=error instanceof Error?error.message:String(error);
   return fail('fetch failed: '+reason);
  }
  const payload=envelope.result as {predictions?:unknown;error?:unknown}|null;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return fail('unexpected response shape from CO-OPS datagetter');
  if(payload.error&&typeof payload.error==='object'){
   const message=(payload.error as {message?:unknown}).message;
   return fail('CO-OPS error: '+(typeof message==='string'?message.trim():'unknown error'));
  }
  const predictions:CoopsPrediction[]=[];
  if(Array.isArray(payload.predictions)){
   for(const row of payload.predictions){
    const item=row as {t?:unknown;v?:unknown}|null;
    if(!item||typeof item!=='object')continue;
    const value=parseNumber(item.v);
    if(value===null)continue;
    if(typeof item.t!=='string'||!item.t.trim())continue;
    predictions.push({stationId:station,predictedAt:item.t,value});
   }
  }
  if(predictions.length===0)return fail('no usable tide predictions for station '+station);
  const result:CoopsPredictionResult={station,datum,units,timeZone,predictions,unavailable:[],queryUrl:url};
  return buildEnvelope(this.sourceId,result,envelope.evidence,citations,'UNVERIFIED');
 }
}
