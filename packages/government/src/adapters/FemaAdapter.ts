import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';
import { getLocalHolding, type LocalHoldingsOptions } from '../localHoldings.ts';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export class FemaAdapter {
 readonly sourceId='fema-nfhl';
 readonly endpoint='https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer';
 async getMetadata(options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<{layers?:unknown;tables?:unknown;[key:string]:unknown}>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'?f=pjson',options);
 }
 async getLayer(layerId:number,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  if(!Number.isInteger(layerId)||layerId<0||layerId>1000)throw new Error('FEMA_LAYER_ID_INVALID');
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+layerId+'?f=pjson',options);
 }
 /**
  * Serve the locally-held NFHL flood-zone GeoJSON for a county FIPS.
  *
  * The files live outside git (large-data policy) under a data root; the
  * bundled holdings manifest records their SHA-256. Every file is
  * hash-verified before serving. Throws LOCAL_HOLDINGS_NOT_PRESENT (with the
  * exact expected path) or LOCAL_HOLDINGS_ROOT_NOT_CONFIGURED when the data
  * root is not set — never a fabricated result.
  */
 getLocalFloodZones(countyFips:string,options:LocalHoldingsOptions={}):EvidenceEnvelope<unknown> {
  if(!/^\d{5}$/.test(countyFips))throw new Error('FEMA_COUNTY_FIPS_INVALID:'+countyFips);
  const manifestPath=options.manifestPath??resolve(join(fileURLToPath(import.meta.url),'..','..','snapshots','nfhl-holdings-manifest.json'));
  return getLocalHolding(manifestPath,entry=>entry.county===countyFips,options);
 }
}
