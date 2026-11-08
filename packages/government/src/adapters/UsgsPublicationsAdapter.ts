import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';

export interface UsgsPublicationsAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

/**
 * USGS Publications Warehouse (pubs-services).
 *
 * Search results identify publications and metadata only; download and hash
 * the actual cited artifact before using it as computation evidence.
 *
 * Live methods perform network fetches and are for USER-INITIATED use only
 * (no polling, no background refresh). Failures surface as honest
 * GOVERNMENT_SOURCE_* errors from queryGovernmentJson — never fabricated.
 */
export class UsgsPublicationsAdapter {
 readonly sourceId='usgs-publications';
 readonly endpoint='https://pubs.usgs.gov/pubs-services/publication';
 async searchPublications(q:string,options:UsgsPublicationsAdapterOptions&{limit?:number}={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  if(typeof q!=='string'||!q.trim())throw new Error('USGS_PUBLICATIONS_QUERY_INVALID');
  const limit=options.limit??15;
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('USGS_PUBLICATIONS_LIMIT_INVALID:'+String(options.limit));
  const url=new URL(this.endpoint);
  url.searchParams.set('mimetype','json');
  url.searchParams.set('q',q.trim());
  url.searchParams.set('pageSize',String(limit));
  const {limit: _limit, ...queryOptions}=options;
  return queryGovernmentJson(this.sourceId,url.toString(),queryOptions);
 }
 async getPublication(id:string|number,options:UsgsPublicationsAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  const publicationId=String(id).trim();
  if(!publicationId)throw new Error('USGS_PUBLICATIONS_ID_INVALID');
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+encodeURIComponent(publicationId)+'?mimetype=json',options);
 }
}
