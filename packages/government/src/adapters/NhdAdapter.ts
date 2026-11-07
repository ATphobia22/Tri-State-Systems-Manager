import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';

export interface NhdAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

/**
 * USGS National Hydrography Dataset (NHD) — legacy reference via ArcGIS
 * MapServer. Retained for legacy reference; prefer 3DHP where coverage is
 * available. Hydrography is not a surveyed channel cross-section, bathymetric
 * surface, or calibrated hydraulic model, and is not site-specific
 * regulatory evidence.
 *
 * Live methods perform network fetches and are for USER-INITIATED use only
 * (no polling, no background refresh). Failures surface as honest
 * GOVERNMENT_SOURCE_* errors from queryGovernmentJson — never fabricated.
 *
 * NOTE: this service answers `f=pjson` with `Content-Type: text/plain`,
 * which queryGovernmentJson rightly rejects as non-JSON, so all requests
 * use `f=json` (verified live 2026-11-07: `f=json` returns
 * `application/json` with identical JSON content).
 */
export class NhdAdapter {
 readonly sourceId='usgs-nhd';
 readonly endpoint='https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer';
 private checkLayerId(layerId:number):void {
  if(!Number.isInteger(layerId)||layerId<0)throw new Error('NHD_LAYER_ID_INVALID:'+String(layerId));
 }
 async getServiceMetadata(options:NhdAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'?f=json',options);
 }
 async getLayer(layerId:number,options:NhdAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  this.checkLayerId(layerId);
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+layerId+'?f=json',options);
 }
 /**
  * Bounded attribute query against one NHD layer. Geometry is not returned
  * and at most 100 records are requested (resultRecordCount=100); the
  * service's own maxRecordCount still applies.
  */
 async queryLayer(layerId:number,where:string,options:NhdAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  this.checkLayerId(layerId);
  if(typeof where!=='string'||!where.trim())throw new Error('NHD_WHERE_INVALID');
  const url=new URL(this.endpoint+'/'+layerId+'/query');
  url.searchParams.set('where',where.trim());
  url.searchParams.set('outFields','*');
  url.searchParams.set('returnGeometry','false');
  url.searchParams.set('resultRecordCount','100');
  url.searchParams.set('f','json');
  return queryGovernmentJson(this.sourceId,url.toString(),options);
 }
}
