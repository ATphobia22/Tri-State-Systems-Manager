import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';

export interface TnmAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

export interface TnmSearchProductsInput {
 /** [minLon, minLat, maxLon, maxLat] in WGS 84 decimal degrees. */
 bbox:[number,number,number,number];
 /** Dataset tag(s), e.g. 'US Topo'. */
 datasets?:string;
 /** Product format(s), e.g. 'GeoPDF'. */
 prodFormats?:string;
}

/**
 * The National Map Access API v1 (TNM Access) — catalog discovery only.
 *
 * Results are CATALOG METADATA (product records, download URLs, dataset
 * listings), not terrain measurements: no elevation values are returned by
 * any method here, and no EPQS point-query method exists in this adapter.
 * A catalog record is not a downloaded or coverage-validated asset; download
 * and hash the actual product before using it. EPQS values, where used
 * elsewhere, are interpolated derived elevations — screening/twin
 * use only, never regulatory or FIRM/LOMA evidence.
 *
 * Live methods perform network fetches and are for USER-INITIATED use only
 * (no polling, no background refresh). Failures surface as honest
 * GOVERNMENT_SOURCE_* errors from queryGovernmentJson — never fabricated.
 */
export class TnmAdapter {
 readonly sourceId='usgs-tnm';
 readonly endpoint='https://tnmaccess.nationalmap.gov/api/v1';
 private checkBbox(bbox:unknown):[number,number,number,number] {
  if(!Array.isArray(bbox)||bbox.length!==4||bbox.some((v)=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('TNM_BBOX_INVALID');
  const [minLon,minLat,maxLon,maxLat]=bbox as [number,number,number,number];
  if(minLon< -180||minLon>180||maxLon< -180||maxLon>180||minLat< -90||minLat>90||maxLat< -90||maxLat>90)throw new Error('TNM_BBOX_INVALID');
  if(!(minLon<maxLon)||!(minLat<maxLat))throw new Error('TNM_BBOX_INVALID');
  return [minLon,minLat,maxLon,maxLat];
 }
 private checkOptionalString(value:string|undefined,error:string):void {
  if(value!==undefined&&(typeof value!=='string'||!value.trim()))throw new Error(error);
 }
 async getDatasets(options:TnmAdapterOptions={}):Promise<EvidenceEnvelope<unknown[]>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'/datasets',options);
 }
 async searchProducts(input:TnmSearchProductsInput,options:TnmAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  const bbox=this.checkBbox(input?.bbox);
  this.checkOptionalString(input?.datasets,'TNM_DATASETS_INVALID');
  this.checkOptionalString(input?.prodFormats,'TNM_PROD_FORMATS_INVALID');
  const url=new URL(this.endpoint+'/products');
  url.searchParams.set('bbox',bbox.join(','));
  if(input.datasets)url.searchParams.set('datasets',input.datasets.trim());
  if(input.prodFormats)url.searchParams.set('prodFormats',input.prodFormats.trim());
  return queryGovernmentJson(this.sourceId,url.toString(),options);
 }
}
