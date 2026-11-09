import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';
export class NoaaAdapter {
 readonly sourceId='noaa-weather';
 readonly endpoint='https://api.weather.gov';
 async getApiRoot(options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'/',options);
 }
 async getForecastMetadata(latitude:number,longitude:number,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  if(!Number.isFinite(latitude)||latitude < -90||latitude>90||!Number.isFinite(longitude)||longitude < -180||longitude>180)throw new Error('NOAA_COORDINATES_INVALID');
  const url=this.endpoint+'/points/'+latitude+','+longitude;
  return queryGovernmentJson(this.sourceId,url,options);
 }

 /** Discover the authoritative NWS grid link from /points; never invent WFO or grid cell. */
 async getPointForecast(latitude:number,longitude:number,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<{
  classification:'FORECAST';location:{latitude:number;longitude:number};issueTime:string|null;validTimes:string|null;
  periods:readonly Record<string,unknown>[];pointUrl:string;forecastUrl:string;
 }>> {
  const point=await this.getForecastMetadata(latitude,longitude,options);
  const props=(point.result as {properties?:{forecast?:unknown}}).properties;
  if(typeof props?.forecast!=='string')throw new Error('NWS_POINTS_MISSING_FORECAST_LINK');
  const forecastLink=new URL(props.forecast);
  if(forecastLink.protocol!=='https:'||forecastLink.origin!==this.endpoint)
   throw new Error('NWS_FORECAST_URL_INVALID');
  if(!/^\/gridpoints\/[A-Za-z0-9_-]+\/\d+,\d+\/forecast(?:\/hourly)?$/.test(forecastLink.pathname)||forecastLink.search||forecastLink.hash)
   throw new Error('NWS_FORECAST_URL_INVALID');
  const forecast=await queryGovernmentJson<{properties?:{updated?:unknown;validTimes?:unknown;periods?:unknown}}>(this.sourceId,forecastLink.toString(),options);
  const fp=forecast.result?.properties;
  if(!Array.isArray(fp?.periods))throw new Error('NWS_FORECAST_PERIODS_MISSING');
  const periods=fp.periods.filter((p):p is Record<string,unknown>=>p!==null&&typeof p==='object'&&!Array.isArray(p)
   &&typeof (p as Record<string,unknown>).startTime==='string'&&typeof (p as Record<string,unknown>).endTime==='string').slice(0,30);
  const result={classification:'FORECAST' as const,location:{latitude,longitude},
   issueTime:typeof fp?.updated==='string'?fp.updated:null,
   validTimes:typeof fp?.validTimes==='string'?fp.validTimes:null,
   periods,pointUrl:point.citations[0].url,forecastUrl:forecastLink.toString()};
  const traceId=randomUUID(),generatedAt=new Date().toISOString(),inputHash=sha256({source:this.sourceId,latitude,longitude,forecastLink:forecastLink.toString()}),outputHash=sha256(result);
  return {result,traceId,hash:outputHash,citations:[...point.citations,...forecast.citations],
   evidence:[...point.evidence,...forecast.evidence],
   provenance:{traceId,provider:this.sourceId,providerVersion:'1',generatedAt,inputHash,outputHash,status:'UNVERIFIED'},
   hashes:{input:inputHash,output:outputHash}};
 }
}
