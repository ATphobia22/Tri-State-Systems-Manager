import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface TigerwebAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}

export interface TigerwebUnavailable {
 readonly reason:string;
}

export interface TigerwebServiceLayer {
 readonly id:number;
 readonly name:string;
 readonly type:string|null;
 readonly geometryType:string|null;
}

export interface TigerwebServiceMetadata {
 readonly service:string;
 readonly serviceDescription:string|null;
 readonly mapName:string|null;
 readonly currentVersion:number|null;
 readonly layers:readonly TigerwebServiceLayer[];
 readonly queryUrl:string;
 readonly unavailable:readonly TigerwebUnavailable[];
}

export interface TigerwebPlacesResult {
 readonly state:string;
 readonly stateFips:string;
 readonly where:string;
 readonly outFields:readonly string[];
 readonly features:readonly Record<string,unknown>[];
 readonly exceededTransferLimit:boolean;
 readonly queryUrl:string;
 readonly unavailable:readonly TigerwebUnavailable[];
}

/**
 * TIGERweb MapServer services verified live 2026-11-07 from the service
 * root listing (GET .../TIGERweb?f=json, HTTP 200) plus direct fetches of
 * Places_CouSub_ConCity_SubMCD, State_County and PUMA_TAD_TAZ_UGA_ZCTA.
 * The tigerWMS_* vintage copies are deliberately excluded.
 */
export const TIGERWEB_SERVICES:readonly string[]=[
 'AIANNHA','CBSA','Hydro','Labels','Legislative',
 'Places_CouSub_ConCity_SubMCD','PUMA_TAD_TAZ_UGA_ZCTA','Region_Division',
 'School','Special_Land_Use_Areas','State_County','Tracts_Blocks',
 'Transportation','TribalTracts','Urban','US_InternationalBoundary_Line','USLandmass',
] as const;

const SERVICE_SET=new Set<string>(TIGERWEB_SERVICES);
/** Incorporated Places (layer 4) of the Places service — verified live 2026-11-07 (Mount Vernon city, IN). */
const PLACES_SERVICE='Places_CouSub_ConCity_SubMCD';
const PLACES_LAYER_ID=4;
const OUTFIELD_RE=/^[A-Za-z0-9_]+(,[A-Za-z0-9_]+)*$/;
const MAX_WHERE_LENGTH=500;
const MAX_RECORDS=100;

/** State / district code or name (case-insensitive) -> 2-digit Census FIPS code. */
const STATE_FIPS:Readonly<Record<string,string>>={
 'AL':'01','ALABAMA':'01','AK':'02','ALASKA':'02','AZ':'04','ARIZONA':'04','AR':'05','ARKANSAS':'05',
 'CA':'06','CALIFORNIA':'06','CO':'08','COLORADO':'08','CT':'09','CONNECTICUT':'09','DE':'10','DELAWARE':'10',
 'DC':'11','DISTRICT OF COLUMBIA':'11','FL':'12','FLORIDA':'12','GA':'13','GEORGIA':'13','HI':'15','HAWAII':'15',
 'ID':'16','IDAHO':'16','IL':'17','ILLINOIS':'17','IN':'18','INDIANA':'18','IA':'19','IOWA':'19',
 'KS':'20','KANSAS':'20','KY':'21','KENTUCKY':'21','LA':'22','LOUISIANA':'22','ME':'23','MAINE':'23',
 'MD':'24','MARYLAND':'24','MA':'25','MASSACHUSETTS':'25','MI':'26','MICHIGAN':'26','MN':'27','MINNESOTA':'27',
 'MS':'28','MISSISSIPPI':'28','MO':'29','MISSOURI':'29','MT':'30','MONTANA':'30','NE':'31','NEBRASKA':'31',
 'NV':'32','NEVADA':'32','NH':'33','NEW HAMPSHIRE':'33','NJ':'34','NEW JERSEY':'34','NM':'35','NEW MEXICO':'35',
 'NY':'36','NEW YORK':'36','NC':'37','NORTH CAROLINA':'37','ND':'38','NORTH DAKOTA':'38','OH':'39','OHIO':'39',
 'OK':'40','OKLAHOMA':'40','OR':'41','OREGON':'41','PA':'42','PENNSYLVANIA':'42','RI':'44','RHODE ISLAND':'44',
 'SC':'45','SOUTH CAROLINA':'45','SD':'46','SOUTH DAKOTA':'46','TN':'47','TENNESSEE':'47','TX':'48','TEXAS':'48',
 'UT':'49','UTAH':'49','VT':'50','VERMONT':'50','VA':'51','VIRGINIA':'51','WA':'53','WASHINGTON':'53',
 'WV':'54','WEST VIRGINIA':'54','WI':'55','WISCONSIN':'55','WY':'56','WYOMING':'56',
};

function resolveState(state:string):{code:string; fips:string}|null {
 if(typeof state!=='string')return null;
 const key=state.trim().toUpperCase();
 const fips=STATE_FIPS[key];
 if(!fips)return null;
 const twoLetter=Object.entries(STATE_FIPS).find(([k,v])=>v===fips&&k.length===2)?.[0]??key;
 return {code:twoLetter,fips};
}

function buildMetadataEnvelope(result:TigerwebServiceMetadata,evidence:EvidenceEnvelope<unknown>['evidence'],citations:EvidenceEnvelope<unknown>['citations'],status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<TigerwebServiceMetadata> {
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId:'census-tigerweb',queryUrl:result.queryUrl});
 return {result,traceId,hash:outputHash,citations,evidence,provenance:{traceId,provider:'census-tigerweb',providerVersion:'1',generatedAt,inputHash,outputHash,status},hashes:{input:inputHash,output:outputHash}};
}

function buildPlacesEnvelope(result:TigerwebPlacesResult,evidence:EvidenceEnvelope<unknown>['evidence'],citations:EvidenceEnvelope<unknown>['citations'],status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<TigerwebPlacesResult> {
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId:'census-tigerweb',queryUrl:result.queryUrl});
 return {result,traceId,hash:outputHash,citations,evidence,provenance:{traceId,provider:'census-tigerweb',providerVersion:'1',generatedAt,inputHash,outputHash,status},hashes:{input:inputHash,output:outputHash}};
}

function parseServiceMetadata(payload:unknown,service:string,queryUrl:string):TigerwebServiceMetadata|null {
 const root=(payload as Record<string,unknown>|null|undefined);
 if(!root||typeof root!=='object'||Array.isArray(root))return null;
 if(!Array.isArray(root['layers']))return null;
 const layers=(root['layers'] as unknown[]).map((layer)=>{
  const l=(layer as Record<string,unknown>|null|undefined)??{};
  return {
   id:typeof l['id']==='number'?l['id']:-1,
   name:typeof l['name']==='string'?l['name']:'',
   type:typeof l['type']==='string'?l['type']:null,
   geometryType:typeof l['geometryType']==='string'?l['geometryType']:null,
  };
 });
 return {
  service,
  serviceDescription:typeof root['serviceDescription']==='string'?root['serviceDescription']:null,
  mapName:typeof root['mapName']==='string'?root['mapName']:null,
  currentVersion:typeof root['currentVersion']==='number'?root['currentVersion']:null,
  layers,queryUrl,unavailable:[],
 };
}

function parsePlaces(payload:unknown,state:string,stateFips:string,where:string,outFields:string[],queryUrl:string):TigerwebPlacesResult|null {
 const root=(payload as Record<string,unknown>|null|undefined);
 if(!root||typeof root!=='object'||Array.isArray(root))return null;
 if(!Array.isArray(root['features']))return null;
 const features=(root['features'] as unknown[])
  .map((f)=>{
   const attrs=(f as Record<string,unknown>|null|undefined)?.['attributes'];
   return attrs&&typeof attrs==='object'&&!Array.isArray(attrs)?attrs as Record<string,unknown>:null;
  })
  .filter((a):a is Record<string,unknown>=>a!==null);
 return {
  state,stateFips,where,outFields,features,
  exceededTransferLimit:root['exceededTransferLimit']===true,
  queryUrl,unavailable:[],
 };
}

/**
 * Census TIGERweb ArcGIS REST services (sourceId 'census-tigerweb').
 * No API key required. NOTE: this adapter deliberately does NOT use
 * api.census.gov — a live probe on 2026-11-07 showed it 302-redirects to
 * a missing-key page without an API key, so the Census API is blocked
 * (key required); TIGERweb needs no key.
 *
 * Live methods — on-demand fetch only, no polling, no background
 * refresh. Statistical boundaries are not parcel or legal property
 * boundaries. Transport or shape failures are reported as an honest
 * UNAVAILABLE envelope — never fabricated, never fail-closed.
 *
 * NOTE on `f=json` vs `f=pjson`: TIGERweb returns Content-Type text/plain
 * for `?f=pjson`, which the JSON gate in queryGovernmentJson rejects;
 * `?f=json` returns the same payload as application/json (verified live
 * 2026-11-07), so this adapter uses `f=json`.
 */
export class TigerwebAdapter {
 readonly sourceId='census-tigerweb';
 readonly endpoint='https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';

 async getServiceMetadata(service:string,options:TigerwebAdapterOptions={}):Promise<EvidenceEnvelope<TigerwebServiceMetadata>> {
  if(typeof service!=='string'||!SERVICE_SET.has(service))throw new Error('TIGERWEB_SERVICE_INVALID:'+String(service));
  const queryUrl=this.endpoint+'/'+service+'/MapServer?f=json';
  const retrievedAt=new Date().toISOString();
  const failureResult=(reason:string):TigerwebServiceMetadata=>({service,serviceDescription:null,mapName:null,currentVersion:null,layers:[],queryUrl,unavailable:[{reason}]});
  const failureEvidence=(reason:string):EvidenceEnvelope<unknown>['evidence']=>[{sourceId:this.sourceId,authority:'CENSUS',retrievedAt,sha256:sha256({queryUrl,reason}),mediaType:'application/json'}];
  const citations:EvidenceEnvelope<unknown>['citations']=[{url:queryUrl,title:'Census TIGERweb '+service+' MapServer metadata (attempted)',retrievedAt}];
  let envelope:EvidenceEnvelope<unknown>;
  try {
   envelope=await queryGovernmentJson<unknown>(this.sourceId,queryUrl,options);
  } catch(error){
   const reason='fetch failed: '+(error instanceof Error?error.message:String(error));
   return buildMetadataEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  const parsed=parseServiceMetadata(envelope.result,service,queryUrl);
  if(!parsed){
   const reason='response did not contain the expected TIGERweb MapServer layers array';
   return buildMetadataEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  return buildMetadataEnvelope(parsed,envelope.evidence,envelope.citations,'UNVERIFIED');
 }

 async queryPlaces(input:{state:string;where:string;outFields?:string[]},options:TigerwebAdapterOptions={}):Promise<EvidenceEnvelope<TigerwebPlacesResult>> {
  const resolved=resolveState(input.state);
  if(!resolved)throw new Error('TIGERWEB_STATE_INVALID:'+String(input.state));
  if(typeof input.where!=='string'||!input.where.trim()||input.where.length>MAX_WHERE_LENGTH)throw new Error('TIGERWEB_WHERE_INVALID:expected a non-empty where clause of at most '+MAX_WHERE_LENGTH+' characters');
  const outFields=input.outFields??['NAME','STATE','BASENAME'];
  if(!Array.isArray(outFields)||outFields.length===0||!OUTFIELD_RE.test(outFields.join(',')))throw new Error('TIGERWEB_OUTFIELDS_INVALID');
  const where='('+input.where.trim()+") AND STATE='"+resolved.fips+"'";
  const url=new URL(this.endpoint+'/'+PLACES_SERVICE+'/MapServer/'+PLACES_LAYER_ID+'/query');
  url.searchParams.set('where',where);
  url.searchParams.set('outFields',outFields.join(','));
  url.searchParams.set('returnGeometry','false');
  url.searchParams.set('f','json');
  url.searchParams.set('resultRecordCount',String(MAX_RECORDS));
  const queryUrl=url.toString();
  const retrievedAt=new Date().toISOString();
  const failureResult=(reason:string):TigerwebPlacesResult=>({state:resolved.code,stateFips:resolved.fips,where,outFields,features:[],exceededTransferLimit:false,queryUrl,unavailable:[{reason}]});
  const failureEvidence=(reason:string):EvidenceEnvelope<unknown>['evidence']=>[{sourceId:this.sourceId,authority:'CENSUS',retrievedAt,sha256:sha256({queryUrl,reason}),mediaType:'application/json'}];
  const citations:EvidenceEnvelope<unknown>['citations']=[{url:queryUrl,title:'Census TIGERweb Places query (attempted)',retrievedAt}];
  let envelope:EvidenceEnvelope<unknown>;
  try {
   envelope=await queryGovernmentJson<unknown>(this.sourceId,queryUrl,options);
  } catch(error){
   const reason='fetch failed: '+(error instanceof Error?error.message:String(error));
   return buildPlacesEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  const parsed=parsePlaces(envelope.result,resolved.code,resolved.fips,where,outFields,queryUrl);
  if(!parsed){
   const reason='response did not contain the expected TIGERweb query features array';
   return buildPlacesEnvelope(failureResult(reason),failureEvidence(reason),citations,'UNAVAILABLE');
  }
  return buildPlacesEnvelope(parsed,envelope.evidence,envelope.citations,'UNVERIFIED');
 }
}
