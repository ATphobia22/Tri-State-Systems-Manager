import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface UsgsOgcV1AdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

export interface UsgsOgcV1Reading {
 /** USGS site number, e.g. '03381700'. */
 readonly siteId:string;
 /** OGC monitoring_location_id, e.g. 'USGS-03381700'. */
 readonly monitoringLocationId:string;
 /** USGS parameter code: '00065' gage height, '00060' discharge. */
 readonly parameterCode:string;
 readonly value:number;
 readonly unit:string|null;
 /** Observation timestamp from the feature (ISO 8601, as reported by USGS). */
 readonly observedAt:string;
 /** USGS approval_status, e.g. 'Provisional' | 'Approved' — provisional values are not independently validated. */
 readonly approvalStatus:string|null;
 /**
  * Gage height (00065) is measured on the site's gage datum — NOT NAVD88.
  * Discharge (00060) has no vertical datum (null).
  */
 readonly verticalDatum:'GAGE_DATUM'|null;
 /**
  * Which fabric path served this reading. The legacy NWIS IV path reports
  * 'usgs-nwis'; this adapter always reports 'usgs-ogc-v1'.
  */
 readonly path:'usgs-ogc-v1';
}

export interface UsgsOgcV1Unavailable {
 readonly siteId:string;
 readonly reason:string;
}

export interface UsgsOgcV1Result {
 readonly readings:readonly UsgsOgcV1Reading[];
 readonly unavailable:readonly UsgsOgcV1Unavailable[];
 /** The per-site request URLs that were attempted (provenance). */
 readonly queryUrls:readonly string[];
}

const SITE_RE=/^[0-9]{8}$/;
const PARAM_RE=/^[0-9]{5}(,[0-9]{5})*$/;
/** USGS no-data sentinel, consistent with tsm-console/src/lib/usgs-direct.ts. */
/** Values reserved for missing USGS observations; none are valid stage/discharge measurements. */
const NO_DATA_VALUES=new Set([-999,-9999,-8888]);
const NUMERIC_RE=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseObservationValue(raw:unknown):number|null {
 if(typeof raw!=='number'&&typeof raw!=='string')return null;
 if(typeof raw==='string'&&!NUMERIC_RE.test(raw.trim()))return null;
 const value=typeof raw==='number'?raw:Number(raw.trim());
 return Number.isFinite(value)&&!NO_DATA_VALUES.has(value)?value:null;
}

function parseFeatures(siteId:string,payload:unknown,requestedParameters:ReadonlySet<string>):UsgsOgcV1Reading[] {
 const features=(payload as {features?:unknown}|null|undefined)?.features;
 if(!Array.isArray(features))return [];
 const expectedLocation='USGS-'+siteId;
 const out:UsgsOgcV1Reading[]=[];
 for(const feature of features){
  const props=(feature as {properties?:unknown}|null|undefined)?.properties as Record<string,unknown>|undefined;
  if(!props||typeof props!=='object'||Array.isArray(props))continue;
  // A response's query parameters are not proof that every returned feature matches.
  // Reject other stations and missing identities rather than silently attributing
  // their measurements to the requested gage.
  if(props['monitoring_location_id']!==expectedLocation)continue;
  const code=props['parameter_code'];
  if(typeof code!=='string'||!requestedParameters.has(code))continue;
  const value=parseObservationValue(props['value']);
  if(value===null)continue;
  const observedAt=props['time'];
  if(typeof observedAt!=='string'||!/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(observedAt)||!Number.isFinite(Date.parse(observedAt)))continue;
  const unit=props['unit_of_measure'];
  if(typeof unit!=='string'||!unit.trim())continue;
  out.push({
   siteId,
   monitoringLocationId:expectedLocation,
   parameterCode:code,
   value,
   unit,
   observedAt,
   approvalStatus:typeof props['approval_status']==='string'?props['approval_status']:null,
   verticalDatum:code==='00065'?'GAGE_DATUM':null,
   path:'usgs-ogc-v1',
  });
 }
 return out;
}

function buildEnvelope(result:UsgsOgcV1Result,evidence:EvidenceEnvelope<unknown>['evidence'],citations:EvidenceEnvelope<unknown>['citations'],status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<UsgsOgcV1Result> {
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId:'usgs-waterdata-ogc',queryUrls:result.queryUrls});
 return {
  result,traceId,hash:outputHash,citations,evidence,
  provenance:{traceId,provider:'usgs-waterdata-ogc',providerVersion:'1',generatedAt,inputHash,outputHash,status},
  hashes:{input:inputHash,output:outputHash},
 };
}

/**
 * USGS Water Data for the Nation — OGC API v1 `latest-continuous` collection.
 *
 * The modern WaterServices successor (WaterServices shuts down 2027-02-22).
 * Verified 2026-10-24: the documented base path `/ogcapi/v1` returns live
 * gage height (00065) and discharge (00060) for all 5 tri-state gauges
 * (03381700, 03378500, 03322000, 03304300, 03377500). An earlier 2026-10-23
 * probe of the wrong base path (`/ogcapi/observations/v1`) returned
 * 200-with-empty bodies — that "200-but-empty" verdict is overturned; it was
 * a wrong-path probe, not an unavailable service.
 *
 * This is an ADDITIONAL path alongside the legacy NWIS IV path (NwisAdapter,
 * sourceId 'usgs-nwis'), which is left intact. Every reading carries
 * `path:'usgs-ogc-v1'` so consumers can tell which path served it.
 *
 * Live methods perform network fetches and are for USER-INITIATED use only,
 * per the river-data policy (no polling, no background refresh). Failures are
 * reported as honest UNAVAILABLE — never fabricated, never fail-closed.
 */
export class UsgsOgcV1Adapter {
 readonly sourceId='usgs-waterdata-ogc';
 readonly endpoint='https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';

 private buildUrl(siteId:string,parameterCd:string):string {
  const url=new URL(this.endpoint);
  url.searchParams.set('f','json');
  url.searchParams.set('monitoring_location_id',`USGS-${siteId}`);
  url.searchParams.set('parameter_code',parameterCd);
  url.searchParams.set('limit','10');
  return url.toString();
 }

 /**
  * Latest continuous observations for the given USGS site numbers.
  * One request per site (the proven query pattern); sites are fetched
  * independently so one site's failure never blocks the others.
  */
 async getLatestContinuous(siteIds:string[],parameterCd='00065,00060',options:UsgsOgcV1AdapterOptions={}):Promise<EvidenceEnvelope<UsgsOgcV1Result>> {
  if(!Array.isArray(siteIds)||siteIds.length===0)throw new Error('USGS_OGC_V1_SITES_REQUIRED');
  for(const siteId of siteIds)if(!SITE_RE.test(siteId))throw new Error('USGS_OGC_V1_SITE_INVALID:'+siteId);
  if(!PARAM_RE.test(parameterCd))throw new Error('USGS_OGC_V1_PARAMETER_CD_INVALID');

  const settlements=await Promise.allSettled(siteIds.map(async(siteId)=>{
   const url=this.buildUrl(siteId,parameterCd);
   const envelope=await queryGovernmentJson<unknown>(this.sourceId,url,options);
   return {siteId,url,envelope};
  }));

  const readings:UsgsOgcV1Reading[]=[];
  const unavailable:UsgsOgcV1Unavailable[]=[];
  const queryUrls:string[]=[];
  const evidence:Array<EvidenceEnvelope<unknown>['evidence'][number]>=[];
  const citations:Array<EvidenceEnvelope<unknown>['citations'][number]>=[];

  settlements.forEach((settlement,index)=>{
   const siteId=siteIds[index];
   const url=this.buildUrl(siteId,parameterCd);
   queryUrls.push(url);
   // A citation records the attempted query URL even when the fetch failed —
   // it documents what was tried, not a successful retrieval.
   citations.push({url,title:'USGS Water Data for the Nation — OGC API v1 latest-continuous (attempted)',retrievedAt:new Date().toISOString()});
   if(settlement.status==='rejected'){
    const reason=settlement.reason instanceof Error?settlement.reason.message:String(settlement.reason);
    unavailable.push({siteId,reason:'fetch failed: '+reason});
    evidence.push({sourceId:this.sourceId,authority:'USGS',retrievedAt:new Date().toISOString(),sha256:sha256({siteId,reason}),mediaType:'application/json'});
    return;
   }
   const {envelope}=settlement.value;
   evidence.push(...envelope.evidence);
   const parsed=parseFeatures(siteId,envelope.result,new Set(parameterCd.split(',')));
   if(parsed.length===0){
    unavailable.push({siteId,reason:'no usable observations matching the requested USGS station and parameter codes'});
    return;
   }
   readings.push(...parsed);
  });

  const result:UsgsOgcV1Result={readings,unavailable,queryUrls};
  const status=readings.length>0?'UNVERIFIED':'UNAVAILABLE';
  return buildEnvelope(result,evidence,citations,status);
 }
}
