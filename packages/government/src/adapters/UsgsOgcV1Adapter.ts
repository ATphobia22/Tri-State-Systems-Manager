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
  // Explicit limit. OGC APIs commonly default to ten features even when
  // more observations matched; this is not proof that retrieval is complete.
  url.searchParams.set('limit','100');
  return url.toString();
 }

 private continuationUrl(href:unknown,current:string,first:string):string {
  if(typeof href!=='string'||!href.trim())throw new Error('USGS_OGC_NEXT_LINK_INVALID');
  const url=new URL(href,current);
  const original=new URL(first);
  if(url.protocol!=='https:'||url.origin!==original.origin||
     url.pathname!==original.pathname||url.username||url.password||url.hash)
   throw new Error('USGS_OGC_NEXT_LINK_OUTSIDE_TRUSTED_COLLECTION');
  for(const key of ['f','monitoring_location_id','parameter_code','limit']){
   if(url.searchParams.get(key)!==original.searchParams.get(key))
    throw new Error('USGS_OGC_NEXT_LINK_CHANGED_FILTER:'+key);
  }
  return url.toString();
 }

 /**
  * Latest continuous observations for the given USGS site numbers.
  * A site is either fully paginated or unavailable; partial pages are never
  * treated as complete observations. Other sites remain independently usable.
  */
 async getLatestContinuous(siteIds:string[],parameterCd='00065,00060',options:UsgsOgcV1AdapterOptions={}):Promise<EvidenceEnvelope<UsgsOgcV1Result>> {
  if(!Array.isArray(siteIds)||siteIds.length===0)throw new Error('USGS_OGC_V1_SITES_REQUIRED');
  for(const siteId of siteIds)if(!SITE_RE.test(siteId))throw new Error('USGS_OGC_V1_SITE_INVALID:'+siteId);
  if(!PARAM_RE.test(parameterCd))throw new Error('USGS_OGC_V1_PARAMETER_CD_INVALID');

  const pageCap=25;
  const stations=await Promise.all(siteIds.map(async(siteId)=>{
   const attempted:string[]=[];
   const evidence:Array<EvidenceEnvelope<unknown>['evidence'][number]>=[];
   const citations:Array<EvidenceEnvelope<unknown>['citations'][number]>=[];
   const readings:UsgsOgcV1Reading[]=[];
   const first=this.buildUrl(siteId,parameterCd);
   let current:string|null=first;
   let featuresSeen=0;
   let matched:number|null=null;
   const seen=new Set<string>();
   try {
    for(let page=0;current!==null;page++){
     if(page>=pageCap)throw new Error('USGS_OGC_PAGINATION_PAGE_CAP_EXCEEDED');
     if(seen.has(current))throw new Error('USGS_OGC_PAGINATION_CYCLE');
     seen.add(current);
     attempted.push(current);
     citations.push({url:current,title:'USGS Water Data OGC v1 latest-continuous (attempted)',retrievedAt:new Date().toISOString()});
     const response=await queryGovernmentJson<unknown>(this.sourceId,current,options);
     evidence.push(...response.evidence);
     const document=response.result as {type?:unknown;features?:unknown;links?:unknown;numberReturned?:unknown;numberMatched?:unknown}|null;
     if(!document||document.type!=='FeatureCollection'||!Array.isArray(document.features))
      throw new Error('USGS_OGC_FEATURE_COLLECTION_INVALID');
     const count=document.features.length;
     if(document.numberReturned!==undefined&&
       (!Number.isSafeInteger(document.numberReturned)||document.numberReturned!==count))
      throw new Error('USGS_OGC_NUMBER_RETURNED_MISMATCH');
     if(typeof document.numberMatched==='number'){
      if(!Number.isSafeInteger(document.numberMatched)||document.numberMatched<0)
       throw new Error('USGS_OGC_NUMBER_MATCHED_INVALID');
      if(matched!==null&&matched!==document.numberMatched)
       throw new Error('USGS_OGC_NUMBER_MATCHED_CHANGED');
      matched=document.numberMatched;
     }
     featuresSeen+=count;
     readings.push(...parseFeatures(siteId,document,new Set(parameterCd.split(','))));
     if(document.links!==undefined&&!Array.isArray(document.links))
      throw new Error('USGS_OGC_PAGINATION_LINKS_INVALID');
     const continuation=(document.links??[] as unknown[]).filter(link=>
      link&&typeof link==='object'&&(link as {rel?:unknown}).rel==='next');
     if(continuation.length>1)throw new Error('USGS_OGC_PAGINATION_AMBIGUOUS');
     if(continuation.length&&count===0)throw new Error('USGS_OGC_EMPTY_PAGE_WITH_NEXT');
     current=continuation.length?this.continuationUrl(
      (continuation[0] as {href?:unknown}).href,attempted[attempted.length-1],first):null;
    }
    if(matched!==null&&featuresSeen!==matched)
     throw new Error('USGS_OGC_INCOMPLETE_PAGINATION');
    readings.sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)||
      a.parameterCode.localeCompare(b.parameterCode));
    return {siteId,attempted,citations,evidence,readings,reason:null as string|null};
   }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    return {siteId,attempted,citations,evidence,readings:[] as UsgsOgcV1Reading[],
      reason:'fetch failed or incomplete: '+reason};
   }
  }));

  const readings:UsgsOgcV1Reading[]=[];
  const unavailable:UsgsOgcV1Unavailable[]=[];
  const queryUrls:string[]=[];
  const evidence:Array<EvidenceEnvelope<unknown>['evidence'][number]>=[];
  const citations:Array<EvidenceEnvelope<unknown>['citations'][number]>=[];
  for(const station of stations){
   queryUrls.push(...station.attempted);
   citations.push(...station.citations);
   evidence.push(...station.evidence);
   if(station.reason||station.readings.length===0){
    const reason=station.reason??'no usable observations matching the requested USGS station and parameter codes';
    unavailable.push({siteId:station.siteId,reason});
    // A failed request may have no HTTP source receipt; record its failure
    // as a derived, honest receipt rather than fabricating fetched bytes.
    if(station.evidence.length===0)
     evidence.push({sourceId:this.sourceId,authority:'USGS',retrievedAt:new Date().toISOString(),
       sha256:sha256({siteId:station.siteId,reason}),mediaType:'application/json'});
   }else readings.push(...station.readings);
  }
  const result:UsgsOgcV1Result={readings,unavailable,queryUrls};
  const status=readings.length>0?'UNVERIFIED':'UNAVAILABLE';
  return buildEnvelope(result,evidence,citations,status);
 }
}
