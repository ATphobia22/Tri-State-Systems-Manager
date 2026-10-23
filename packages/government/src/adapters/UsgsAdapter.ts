import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';
export class UsgsAdapter {
 readonly sourceId='usgs-3dep';
 readonly endpoint='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer';
 async getMetadata(options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'?f=pjson',options);
 }
}
