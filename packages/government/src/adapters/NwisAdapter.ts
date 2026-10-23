import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';
import { loadPinnedSnapshot } from '../snapshots.ts';

export interface NwisAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;snapshotsDir?:string;
}
const SITES=/^[0-9]+(,[0-9]+)*$/;
/**
 * USGS NWIS water data (legacy waterservices).
 *
 * Only the JSON instantaneous-values (IV) service is wired for live fetch:
 * the site-metadata service has no JSON format (verified 2026-10-23 —
 * format=json returns HTTP 400), so site metadata (including NAVD88 datums)
 * is served from the pinned snapshot.
 *
 * Live methods are for USER-INITIATED use only, per the river-data policy
 * (no polling, no background refresh).
 */
export class NwisAdapter {
 readonly sourceId='usgs-nwis';
 readonly endpoint='https://waterservices.usgs.gov/nwis';
 private checkSites(sites:string):void {
  if(!SITES.test(sites))throw new Error('NWIS_SITES_INVALID:'+sites);
 }
 async getIv(sites:string,parameterCd='00065,00060',options:NwisAdapterOptions={}):Promise<EvidenceEnvelope<{value?:unknown;[key:string]:unknown}>> {
  this.checkSites(sites);
  if(!/^[0-9,]+$/.test(parameterCd))throw new Error('NWIS_PARAMETER_CD_INVALID');
  const url=this.endpoint+'/iv/?format=json&sites='+encodeURIComponent(sites)+'&parameterCd='+encodeURIComponent(parameterCd)+'&siteStatus=all';
  return queryGovernmentJson(this.sourceId,url,options);
 }
 /** Pinned 5-gage site metadata (incl. verified NAVD88 datums), retrieved 2026-10-23. */
 getSitesSnapshot(snapshotsDir?:string):EvidenceEnvelope<{sites?:unknown;[key:string]:unknown}> {
  return loadPinnedSnapshot(this.sourceId,'usgs-5gage-sites.json',snapshotsDir);
 }
}
