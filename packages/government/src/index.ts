import { createHash, randomUUID } from 'node:crypto';

export type GovernmentAuthority = 'FEMA'|'USGS'|'NOAA'|'CENSUS'|'EPA'|'USDA'|'DOT'|'USACE';
export type EvidenceStatus = 'VALIDATED'|'UNVERIFIED'|'UNAVAILABLE'|'REJECTED';
export interface EvidenceEnvelope<T> {
  result: T; citations: readonly {url:string; title?:string; retrievedAt:string}[];
  evidence: readonly {sourceId:string; authority:GovernmentAuthority; retrievedAt:string; sha256:string; mediaType:string}[];
  provenance: {traceId:string; provider:string; providerVersion:string; generatedAt:string; inputHash:string; outputHash:string; status:EvidenceStatus};
  hashes: {input:string; output:string};
}
export interface GovernmentSource {
  readonly id:string; readonly authority:GovernmentAuthority; readonly title:string; readonly endpoint:string;
  readonly access:'REST_JSON'|'DOWNLOAD'|'CATALOG'; readonly purpose:string;
  readonly limitations:readonly string[];
}
export const GOVERNMENT_SOURCES: readonly GovernmentSource[] = [
 {id:'fema-nfhl',authority:'FEMA',title:'National Flood Hazard Layer',endpoint:'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',access:'REST_JSON',purpose:'Effective flood hazard layer discovery and query',limitations:['A layer query is not a site-specific flood determination. Verify effective date, community, panel, and LOMR status.']},
 {id:'usgs-3dep',authority:'USGS',title:'3D Elevation Program',endpoint:'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',access:'REST_JSON',purpose:'Elevation service discovery and profile/query',limitations:['Resolution, acquisition vintage, vertical datum, units, and nodata must be retained per result.']},
 {id:'usgs-hydrography',authority:'USGS',title:'National Hydrography',endpoint:'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer',access:'REST_JSON',purpose:'Hydrography feature discovery',limitations:['Hydrography is not a surveyed channel cross-section or hydraulic model.']},
 {id:'noaa-coops',authority:'NOAA',title:'CO-OPS water levels and tides',endpoint:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',access:'REST_JSON',purpose:'Tides and observed water levels',limitations:['Station coverage varies; tidal predictions are not storm-surge forecasts.']},
 {id:'noaa-weather',authority:'NOAA',title:'National Weather Service API',endpoint:'https://api.weather.gov',access:'REST_JSON',purpose:'Forecasts, alerts, and grid metadata',limitations:['Forecasts are time- and grid-specific; retain issuance and valid times.']},
 {id:'census-tiger',authority:'CENSUS',title:'TIGER/Line and Census geographies',endpoint:'https://api.census.gov/data',access:'REST_JSON',purpose:'Census statistical geographies and attributes',limitations:['Statistical boundaries are not parcel or legal property boundaries.']},
 {id:'epa-waters',authority:'EPA',title:'How’s My Waterway / WATERS',endpoint:'https://www.epa.gov/waterdata',access:'CATALOG',purpose:'Water quality and regulatory water-program discovery',limitations:['Program coverage and reporting dates differ; verify each dataset’s metadata and authority.']},
 {id:'usda-soils',authority:'USDA',title:'NRCS Soil Data Access / SSURGO',endpoint:'https://SDMDataAccess.sc.egov.usda.gov',access:'REST_JSON',purpose:'Soil survey attributes and map unit lookup',limitations:['Map-unit interpretations are not site-specific geotechnical borings.']},
 {id:'dot-nbi',authority:'DOT',title:'FHWA National Bridge Inventory',endpoint:'https://www.fhwa.dot.gov/bridge/nbi.cfm',access:'DOWNLOAD',purpose:'Bridge inventory discovery',limitations:['Inventory attributes are not a current inspection or structural rating unless explicitly dated.']},
 {id:'usace-levees',authority:'USACE',title:'National Levee Database',endpoint:'https://levees.sec.usace.army.mil',access:'CATALOG',purpose:'Levee inventory and study discovery',limitations:['Inventory presence does not establish accreditation, condition, or protection level.']}
] as const;

function canonical(value:unknown):string {
 if(value===null||typeof value!=='object') return JSON.stringify(value) ?? 'null';
 if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
 const object=value as Record<string,unknown>;
 return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key])).join(',')+'}';
}
export function sha256(value:unknown):string{return createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');}
export function getGovernmentSource(id:string):GovernmentSource {
 const source=GOVERNMENT_SOURCES.find(item=>item.id===id);
 if(!source) throw new Error('GOVERNMENT_SOURCE_NOT_REGISTERED:'+id);
 return source;
}
export async function queryGovernmentJson<T=unknown>(sourceId:string,url:string,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<T>> {
 const source=getGovernmentSource(sourceId);
 if(source.access!=='REST_JSON') throw new Error('GOVERNMENT_SOURCE_REQUIRES_SPECIALIZED_ADAPTER');
 const requested=new URL(url); const registered=new URL(source.endpoint);
 if(requested.protocol!=='https:'||requested.origin!==registered.origin||!requested.pathname.startsWith(registered.pathname))
   throw new Error('GOVERNMENT_URL_OUTSIDE_REGISTERED_ENDPOINT');
 const timeoutMs=options.timeoutMs??15000;
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>120000) throw new Error('INVALID_TIMEOUT_MS');
 const traceId=randomUUID(),generatedAt=new Date().toISOString(),inputHash=sha256({sourceId,url:requested.toString()});
 const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(new Error('timeout')),timeoutMs);
 const abort=()=>controller.abort(options.signal?.reason);
 if(options.signal?.aborted) controller.abort(options.signal.reason);
 else options.signal?.addEventListener('abort',abort,{once:true});
 try {
   const response=await (options.fetcher??fetch)(requested,{signal:controller.signal,headers:{accept:'application/json'}});
   if(!response.ok) throw new Error('GOVERNMENT_SOURCE_HTTP_'+response.status);
   const mediaType=response.headers.get('content-type')??'';
   if(!/json/i.test(mediaType)) throw new Error('GOVERNMENT_SOURCE_NON_JSON_RESPONSE');
   const raw=await response.text();
   if(raw.length>25_000_000) throw new Error('GOVERNMENT_RESPONSE_TOO_LARGE');
   let result:T; try { result=JSON.parse(raw) as T; } catch { throw new Error('GOVERNMENT_SOURCE_INVALID_JSON'); }
   const outputHash=sha256(result);
   const retrievedAt=new Date().toISOString();
   return {result,citations:[{url:requested.toString(),title:source.title,retrievedAt}],evidence:[{sourceId:source.id,authority:source.authority,retrievedAt,sha256:sha256(raw),mediaType}],provenance:{traceId,provider:source.id,providerVersion:'1',generatedAt,inputHash,outputHash,status:'UNVERIFIED'},hashes:{input:inputHash,output:outputHash}};
 } finally {clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
}
export function validateEvidenceEnvelope(value:EvidenceEnvelope<unknown>):readonly string[] {
 const errors:string[]=[];
 if(!value.provenance.traceId.trim()) errors.push('traceId is required');
 if(!/^[a-f0-9]{64}$/.test(value.hashes.input)||!/^[a-f0-9]{64}$/.test(value.hashes.output)) errors.push('SHA-256 hashes must be lowercase 64-character hex');
 if(value.provenance.outputHash!==value.hashes.output||sha256(value.result)!==value.hashes.output) errors.push('output hash does not match result');
 if(value.evidence.length===0) errors.push('at least one evidence record is required');
 if(value.citations.some(citation=>new URL(citation.url).protocol!=='https:')) errors.push('citations must use HTTPS');
 return errors;
}
