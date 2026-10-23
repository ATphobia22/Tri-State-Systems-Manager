import { queryGovernmentJson, type EvidenceEnvelope } from '../index.ts';
import { loadPinnedSnapshot } from '../snapshots.ts';

export interface NwpsAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;snapshotsDir?:string;
}
const GAUGE_ID=/^[A-Z0-9]{5}$/;
/**
 * NOAA National Water Prediction Service (NWPS) river gauges.
 *
 * Live methods (getGauge/getStageflow) perform network fetches and are for
 * USER-INITIATED use only, per the river-data policy (no polling, no
 * background refresh). The snapshot methods serve pinned, hash-verified
 * snapshots for offline/default use.
 */
export class NwpsAdapter {
 readonly sourceId='noaa-nwps';
 readonly endpoint='https://api.water.noaa.gov/nwps/v1/gauges';
 /** Tri-state gauges with pinned snapshots held by TSM. */
 static readonly SNAPSHOT_GAUGES:readonly string[]=['MTVI3','SHNI2','NHRI3','EVVI3'];
 private checkGaugeId(gaugeId:string):void {
  if(!GAUGE_ID.test(gaugeId))throw new Error('NWPS_GAUGE_ID_INVALID:'+gaugeId);
 }
 async getGauge(gaugeId:string,options:NwpsAdapterOptions={}):Promise<EvidenceEnvelope<{flood?:unknown;[key:string]:unknown}>> {
  this.checkGaugeId(gaugeId);
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+gaugeId,options);
 }
 async getStageflow(gaugeId:string,options:NwpsAdapterOptions={}):Promise<EvidenceEnvelope<{observed?:unknown;[key:string]:unknown}>> {
  this.checkGaugeId(gaugeId);
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+gaugeId+'/stageflow',options);
 }
 getGaugeSnapshot(gaugeId:string,snapshotsDir?:string):EvidenceEnvelope<{flood?:unknown;[key:string]:unknown}> {
  this.checkGaugeId(gaugeId);
  return loadPinnedSnapshot(this.sourceId,'nws-nwps-'+gaugeId.toLowerCase()+'.json',snapshotsDir);
 }
 getStageflowSnapshot(gaugeId:string,snapshotsDir?:string):EvidenceEnvelope<{observed?:unknown;[key:string]:unknown}> {
  this.checkGaugeId(gaugeId);
  if(gaugeId!=='MTVI3')throw new Error('NWPS_STAGEFLOW_SNAPSHOT_NOT_HELD:'+gaugeId);
  return loadPinnedSnapshot(this.sourceId,'nws-nwps-mtvi3-stageflow.json',snapshotsDir);
 }
}
