import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface EchoAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

export interface EchoUnavailable {
 readonly reason:string;
}

export interface EchoFacilitiesResult {
 readonly zip:string;
 /** ECHO Results.Message, e.g. 'Success', or null when absent. */
 readonly message:string|null;
 /** ECHO Results.Version, e.g. 'CWA v2017-10-13 1325', or null when absent. */
 readonly version:string|null;
 /** ECHO Results.QueryRows as a number, or null when absent/unparseable. */
 readonly queryRows:number|null;
 /** Numeric summary counts from Results (*Rows fields), keyed as returned. */
 readonly counts:Readonly<Record<string,number>>;
 /**
  * Facility records as returned under Results.Facilities.
  *
  * VERIFIED LIVE 2026-11-07: the CWA get_facilities service returns a
  * summary-only Results object (Message/Version/QueryRows plus *Rows
  * counts) with NO Facilities array for ZIP 47620 and ZIP 10001, so this
  * is normally empty — the summary counts are the real evidence. Records
  * are carried verbatim only when the service actually returns them.
  */
 readonly facilities:readonly Record<string,unknown>[];
 readonly queryUrl:string;
 readonly unavailable:readonly EchoUnavailable[];
}

const ZIP_RE=/^\d{5}$/;

function parseCount(value:unknown):number|null {
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'&&/^\d+$/.test(value.trim()))return Number(value.trim());
 return null;
}

function parseFacilities(payload:unknown,zip:string,queryUrl:string):EchoFacilitiesResult|null {
 const root=(payload as Record<string,unknown>|null|undefined);
 if(!root||typeof root!=='object'||Array.isArray(root))return null;
 const results=root['Results'] as Record<string,unknown>|undefined;
 if(!results||typeof results!=='object'||Array.isArray(results))return null;
 const counts:Record<string,number>={};
 for(const [key,value] of Object.entries(results)){
  if(!key.endsWith('Rows'))continue;
  const count=parseCount(value);
  if(count!==null)counts[key]=count;
 }
 const rawFacilities=results['Facilities'];
 const facilities=Array.isArray(rawFacilities)
  ?rawFacilities.filter((f):f is Record<string,unknown>=>!!f&&typeof f==='object'&&!Array.isArray(f))
  :[];
 return {
  zip,
  message:typeof results['Message']==='string'?results['Message']:null,
  version:typeof results['Version']==='string'?results['Version']:null,
  queryRows:parseCount(results['QueryRows']),
  counts,facilities,queryUrl,unavailable:[],
 };
}

function buildEnvelope(result:EchoFacilitiesResult,evidence:EvidenceEnvelope<unknown>['evidence'],citations:EvidenceEnvelope<unknown>['citations'],status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<EchoFacilitiesResult> {
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId:'epa-facilities',queryUrl:result.queryUrl});
 return {
  result,traceId,hash:outputHash,citations,evidence,
  provenance:{traceId,provider:'epa-facilities',providerVersion:'1',generatedAt,inputHash,outputHash,status},
  hashes:{input:inputHash,output:outputHash},
 };
}

/**
 * EPA ECHO (Enforcement and Compliance History Online) facility data
 * (sourceId 'epa-facilities'), via the CWA REST service get_facilities.
 *
 * Live method — on-demand fetch only, no polling, no background refresh.
 * Reported compliance data may lag and is not an independent site
 * inspection. Transport or shape failures are reported as an honest
 * UNAVAILABLE envelope — never fabricated, never fail-closed.
 *
 * NOTE — no getServiceInfo(): there is no stable JSON services index for
 * ECHO. GET https://echodata.epa.gov/echo/ returns HTTP 302 (verified
 * 2026-11-07); inventing an index URL would be fabrication, so the method
 * is deliberately omitted.
 */
export class EchoAdapter {
 readonly sourceId='epa-facilities';
 readonly endpoint='https://echodata.epa.gov/echo';

 async getFacilitiesByZip(zip:string,options:EchoAdapterOptions={}):Promise<EvidenceEnvelope<EchoFacilitiesResult>> {
  if(typeof zip!=='string'||!ZIP_RE.test(zip))throw new Error('ECHO_ZIP_INVALID:'+String(zip));
  const url=new URL(this.endpoint+'/cwa_rest_services.get_facilities');
  url.searchParams.set('output','JSON');
  url.searchParams.set('p_zip',zip);
  const queryUrl=url.toString();
  const retrievedAt=new Date().toISOString();
  const failureResult=(reason:string):EchoFacilitiesResult=>({zip,message:null,version:null,queryRows:null,counts:{},facilities:[],queryUrl,unavailable:[{reason}]});
  const failureEvidence=(reason:string):EvidenceEnvelope<unknown>['evidence']=>[{sourceId:this.sourceId,authority:'EPA',retrievedAt,sha256:sha256({queryUrl,reason}),mediaType:'application/json'}];
  const citations:EvidenceEnvelope<unknown>['citations']=[{url:queryUrl,title:'EPA ECHO CWA get_facilities (attempted)',retrievedAt}];
  let envelope:EvidenceEnvelope<unknown>;
  try {
   envelope=await queryGovernmentJson<unknown>(this.sourceId,queryUrl,options);
  } catch(error){
   const reason='fetch failed: '+(error instanceof Error?error.message:String(error));
   return buildEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  const parsed=parseFacilities(envelope.result,zip,queryUrl);
  if(!parsed){
   const reason='response did not contain the expected ECHO Results object';
   return buildEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  const status=parsed.message==='Success'?'UNVERIFIED':'UNAVAILABLE';
  const result=status==='UNAVAILABLE'?{...parsed,unavailable:[{reason:'ECHO reported: '+(parsed.message??'no Message')}]}:parsed;
  return buildEnvelope(result,envelope.evidence,envelope.citations,status);
 }
}
