import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';
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
}
