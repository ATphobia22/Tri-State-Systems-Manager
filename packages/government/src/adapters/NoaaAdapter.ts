import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';
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
}
