import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';

/**
 * USACE National Levee Database (NLD) — ArcGIS REST FeatureServer.
 *
 * Live methods perform network fetches and are for USER-INITIATED use only
 * (no polling, no background refresh). Inventory presence does not establish
 * accreditation, condition, or protection level.
 *
 * Verified live 2026-11-07: GET .../FeatureServer?f=pjson returns HTTP 200
 * (8,849 bytes) with 18 layers (0 Boreholes … 16 Leveed Areas, 17 Berms);
 * service maxRecordCount is 2000, so queryLayer caps resultRecordCount
 * at 2000. NOTE: this service answers `?f=pjson` with
 * `Content-Type: text/plain`, which queryGovernmentJson correctly rejects
 * as a non-JSON response — so metadata calls use `?f=json` instead
 * (verified live 2026-11-07: identical keys and layers, compact body,
 * `Content-Type: application/json`). Failures throw the honest
 * GOVERNMENT_SOURCE_* error from queryGovernmentJson — never a fabricated value.
 */
export class NldAdapter {
 readonly sourceId='usace-levees';
 readonly endpoint='https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer';

 private checkLayerId(layerId:number):void {
  if(!Number.isInteger(layerId)||layerId<0||layerId>1000)throw new Error('NLD_LAYER_ID_INVALID:'+layerId);
 }

 async getServiceMetadata(options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<{layers?:unknown;tables?:unknown;[key:string]:unknown}>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'?f=json',options);
 }

 async getLayer(layerId:number,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  this.checkLayerId(layerId);
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+layerId+'?f=json',options);
 }

 /**
  * Bounded attribute query against one NLD layer.
  * `where` is an ArcGIS SQL where-clause (e.g. "1=1"); resultRecordCount is
  * capped at the service maxRecordCount of 2000. Geometry is not returned
  * by default (returnGeometry=false) to keep responses bounded.
  */
 async queryLayer(layerId:number,where:string,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;resultRecordCount?:number;outFields?:string;returnGeometry?:boolean}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  this.checkLayerId(layerId);
  if(typeof where!=='string'||!where.trim())throw new Error('NLD_WHERE_INVALID');
  const resultRecordCount=options.resultRecordCount??100;
  if(!Number.isInteger(resultRecordCount)||resultRecordCount<1||resultRecordCount>2000)throw new Error('NLD_RESULT_RECORD_COUNT_INVALID:'+resultRecordCount);
  const params=new URLSearchParams();
  params.set('where',where);
  params.set('outFields',options.outFields??'*');
  params.set('returnGeometry',options.returnGeometry?'true':'false');
  params.set('resultRecordCount',String(resultRecordCount));
  params.set('f','json');
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+layerId+'/query?'+params.toString(),options);
 }
}
