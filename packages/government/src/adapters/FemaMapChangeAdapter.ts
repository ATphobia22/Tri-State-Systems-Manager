import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

/** FEMA effective NFHL map-layer discovery; NOT a determination or full MSC case search. */
export class FemaMapChangeAdapter {
 readonly sourceId='fema-nfhl';
 readonly endpoint='https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer';
 async discover(kind:'LOMA'|'LOMR',options:{fetcher?:typeof fetch;signal?:AbortSignal;timeoutMs?:number}={}):Promise<EvidenceEnvelope<{kind:string;matches:readonly {id:number;name:string}[];service:string}>> {
  if(kind!=='LOMA'&&kind!=='LOMR')throw new Error('FEMA_CHANGE_KIND_INVALID');
  const catalog=await queryGovernmentJson<{layers?:{id:number;name:string}[];tables?:{id:number;name:string}[]}>('fema-nfhl',this.endpoint+'?f=json',options);
  if(!Array.isArray(catalog.result.layers))throw new Error('FEMA_CHANGE_CATALOG_INVALID');
  const matches=[...catalog.result.layers,...(catalog.result.tables??[])].filter(l=>Number.isInteger(l.id)&&typeof l.name==='string'&&
   (kind==='LOMR'?/LOMR|letter.*map.*revision/i:/LOMA|letter.*map.*amendment/i).test(l.name));
  const result={kind,matches,service:this.endpoint};
  // Reuse evidence from the source metadata fetch; source output is still UNVERIFIED.
  const outputHash=sha256(result);
  return {...catalog,result,hash:outputHash,hashes:{...catalog.hashes,output:outputHash},provenance:{...catalog.provenance,outputHash}};
 }
 async queryCase(kind:'LOMA'|'LOMR',layerId:number,field:string,value:string,options:{fetcher?:typeof fetch;signal?:AbortSignal;timeoutMs?:number}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  const catalog=await this.discover(kind,options);
  if(!catalog.result.matches.some(l=>l.id===layerId))throw new Error('FEMA_CHANGE_LAYER_NOT_IN_CATALOG');
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(field)||! /^[A-Za-z0-9-]{1,48}$/.test(value))throw new Error('FEMA_CHANGE_CASE_QUERY_INVALID');
  // Query only one named case attribute; no caller-controlled SQL fragments.
  const metadata=await queryGovernmentJson<{fields?:{name:string}[]}>('fema-nfhl',this.endpoint+'/'+layerId+'?f=json',options);
  if(!metadata.result.fields?.some(f=>f.name===field))throw new Error('FEMA_CHANGE_FIELD_NOT_REGISTERED');
  const url=new URL(this.endpoint+'/'+layerId+'/query');
  url.searchParams.set('where',field+"='"+value+"'");
  url.searchParams.set('outFields','*');url.searchParams.set('returnGeometry','true');url.searchParams.set('resultRecordCount','100');url.searchParams.set('f','geojson');
  // ArcGIS GeoJSON content types are often application/geo+json; canonical JSON query accepts JSON only.
  url.searchParams.set('f','json');
  return queryGovernmentJson('fema-nfhl',url.toString(),options);
 }
}
