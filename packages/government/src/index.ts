import { createHash, randomUUID } from 'node:crypto';

export type GovernmentAuthority = 'FEMA'|'USGS'|'NOAA'|'CENSUS'|'EPA'|'USDA'|'DOT'|'USACE';
export type EvidenceStatus = 'VALIDATED'|'UNVERIFIED'|'UNAVAILABLE'|'REJECTED';
export interface EvidenceEnvelope<T> {
  result: T; traceId:string; hash:string; citations: readonly {url:string; title?:string; retrievedAt:string}[];
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
 {id:'usgs-hydrography',authority:'USGS',title:'3D Hydrography Program (3DHP)',endpoint:'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/FeatureServer',access:'REST_JSON',purpose:'Current hydrography feature and flow-network discovery',limitations:['Coverage and vintage vary; legacy NHD may supplement areas without elevation-derived hydrography.','Hydrography is not a surveyed channel cross-section, bathymetric surface, or hydraulic model.','Not intended for site-specific regulatory determinations.']},
 {id:'noaa-coops',authority:'NOAA',title:'CO-OPS water levels and tides',endpoint:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',access:'REST_JSON',purpose:'Tides and observed water levels',limitations:['Station coverage varies; tidal predictions are not storm-surge forecasts.']},
 {id:'noaa-weather',authority:'NOAA',title:'National Weather Service API',endpoint:'https://api.weather.gov',access:'REST_JSON',purpose:'Forecasts, alerts, and grid metadata',limitations:['Forecasts are time- and grid-specific; retain issuance and valid times.']},
 {id:'census-tiger',authority:'CENSUS',title:'TIGER/Line and Census geographies',endpoint:'https://api.census.gov/data',access:'REST_JSON',purpose:'Census statistical geographies and attributes',limitations:['Statistical boundaries are not parcel or legal property boundaries.']},
 {id:'epa-waters',authority:'EPA',title:'How’s My Waterway / WATERS',endpoint:'https://www.epa.gov/waterdata',access:'CATALOG',purpose:'Water quality and regulatory water-program discovery',limitations:['Program coverage and reporting dates differ; verify each dataset’s metadata and authority.']},
 {id:'usda-soils',authority:'USDA',title:'NRCS Soil Data Access / SSURGO',endpoint:'https://SDMDataAccess.sc.egov.usda.gov',access:'REST_JSON',purpose:'Soil survey attributes and map unit lookup',limitations:['Map-unit interpretations are not site-specific geotechnical borings.']},
 {id:'dot-nbi',authority:'DOT',title:'FHWA National Bridge Inventory',endpoint:'https://www.fhwa.dot.gov/bridge/nbi.cfm',access:'DOWNLOAD',purpose:'Bridge inventory discovery',limitations:['Inventory attributes are not a current inspection or structural rating unless explicitly dated.']},
 {id:'usace-levees',authority:'USACE',title:'National Levee Database',endpoint:'https://nld.sec.usace.army.mil/data-services/services/',access:'CATALOG',purpose:'Levee inventory and study discovery',limitations:['Inventory presence does not establish accreditation, condition, or protection level.']},
 {id:'usgs-orthoimagery',authority:'USGS',title:'National Map orthoimagery discovery',endpoint:'https://www.usgs.gov/the-national-map-data-delivery/gis-data-download',access:'CATALOG',purpose:'Discover orthoimagery and imagery acquisition metadata',limitations:['Catalog discovery is not a downloaded or coverage-validated imagery asset.']},
 {id:'noaa-sea-level-rise',authority:'NOAA',title:'NOAA Sea Level Rise Viewer',endpoint:'https://coast.noaa.gov/slr/',access:'CATALOG',purpose:'Discover coastal sea-level-rise scenario products',limitations:['Scenario layers are not a deterministic forecast or site-specific engineering water level.']},
 {id:'noaa-storm-surge',authority:'NOAA',title:'National Hurricane Center storm-surge products',endpoint:'https://www.nhc.noaa.gov/',access:'CATALOG',purpose:'Discover official storm-surge products and advisories',limitations:['Advisory products are event-specific; verify issue time, valid period, and local applicability.']},
 {id:'census-tiger-line',authority:'CENSUS',title:'TIGER/Line downloads',endpoint:'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html',access:'CATALOG',purpose:'Discover versioned TIGER/Line geography downloads',limitations:['Statistical boundaries are not parcel or legal property boundaries.']},
 {id:'epa-facilities',authority:'EPA',title:'EPA ECHO facility data',endpoint:'https://echo.epa.gov/',access:'CATALOG',purpose:'Discover regulated facility and compliance-reporting records',limitations:['Reported compliance data may lag and is not an independent site inspection.']},
 {id:'usda-cropland',authority:'USDA',title:'USDA Cropland Data Layer',endpoint:'https://www.nass.usda.gov/Research_and_Science/Cropland/',access:'CATALOG',purpose:'Discover annual cropland classification products',limitations:['Classification accuracy and vintage vary by class and geography.']},
 {id:'usda-forest',authority:'USDA',title:'US Forest Service data discovery',endpoint:'https://www.fs.usda.gov/',access:'CATALOG',purpose:'Discover forest and land-cover data products',limitations:['Product coverage, vintage, and classification semantics must be verified.']},
 ] as const;

function canonical(value:unknown,ancestors:WeakSet<object>=new WeakSet()):string {
 if(value===null)return 'null';
 if(typeof value==='string')return JSON.stringify(value);
 if(typeof value==='boolean')return value?'true':'false';
 if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('CANONICAL_VALUE_MUST_BE_FINITE');return JSON.stringify(value);}
 if(typeof value!=='object')throw new TypeError('CANONICAL_VALUE_MUST_BE_JSON_COMPATIBLE');
 if(ancestors.has(value))throw new TypeError('CANONICAL_VALUE_MUST_NOT_BE_CIRCULAR');
 ancestors.add(value);
 try {
  if(Array.isArray(value))return '['+value.map(item=>canonical(item,ancestors)).join(',')+']';
  const object=value as Record<string,unknown>;
  return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key],ancestors)).join(',')+'}';
 } finally {ancestors.delete(value);}
}
export function sha256(value:unknown):string{return createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');}
export function getGovernmentSource(id:string):GovernmentSource {
 const source=GOVERNMENT_SOURCES.find(item=>item.id===id);
 if(!source) throw new Error('GOVERNMENT_SOURCE_NOT_REGISTERED:'+id);
 return source;
}
async function readBoundedResponseText(response:Response,maxBytes:number):Promise<string> {
 const declaredLength=response.headers.get('content-length');
 if(declaredLength&&/^\d+$/.test(declaredLength)&&Number(declaredLength)>maxBytes)throw new Error('GOVERNMENT_RESPONSE_TOO_LARGE');
 if(!response.body) {
  const raw=await response.text();
  if(new TextEncoder().encode(raw).byteLength>maxBytes)throw new Error('GOVERNMENT_RESPONSE_TOO_LARGE');
  return raw;
 }
 const reader=response.body.getReader();
 const chunks:Uint8Array[]=[];
 let totalBytes=0;
 try {
  while(true) {
   const {done,value}=await reader.read();
   if(done)break;
   totalBytes+=value.byteLength;
   if(totalBytes>maxBytes) {
    await reader.cancel().catch(()=>undefined);
    throw new Error('GOVERNMENT_RESPONSE_TOO_LARGE');
   }
   chunks.push(value);
  }
 } finally {reader.releaseLock();}
 const bytes=new Uint8Array(totalBytes);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch{throw new Error('GOVERNMENT_SOURCE_INVALID_UTF8');}
}

export async function queryGovernmentJson<T=unknown>(sourceId:string,url:string,options:{signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<EvidenceEnvelope<T>> {
 const source=getGovernmentSource(sourceId);
 if(source.access!=='REST_JSON') throw new Error('GOVERNMENT_SOURCE_REQUIRES_SPECIALIZED_ADAPTER');
 const requested=new URL(url); const registered=new URL(source.endpoint);
 if(requested.protocol!=='https:'||requested.username!==''||requested.password!==''||requested.hash!==''||requested.origin!==registered.origin||(registered.pathname!=='/'&&requested.pathname!==registered.pathname&&!requested.pathname.startsWith(registered.pathname+'/')))
   throw new Error('GOVERNMENT_URL_OUTSIDE_REGISTERED_ENDPOINT');
 const timeoutMs=options.timeoutMs??15000;
 if(typeof timeoutMs!=='number'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>120000) throw new Error('INVALID_TIMEOUT_MS');
 const traceId=randomUUID(),generatedAt=new Date().toISOString(),inputHash=sha256({sourceId,url:requested.toString()});
 const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(new Error('timeout')),timeoutMs);
 const abort=()=>controller.abort(options.signal?.reason);
 if(options.signal?.aborted) controller.abort(options.signal.reason);
 else options.signal?.addEventListener('abort',abort,{once:true});
 try {
   if(controller.signal.aborted) throw controller.signal.reason??new Error('GOVERNMENT_REQUEST_ABORTED');
   const response=await (options.fetcher??fetch)(requested,{signal:controller.signal,headers:{accept:'application/json'}});
   if(!response.ok) throw new Error('GOVERNMENT_SOURCE_HTTP_'+response.status);
   const mediaType=response.headers.get('content-type')??'';
   if(!/json/i.test(mediaType)) throw new Error('GOVERNMENT_SOURCE_NON_JSON_RESPONSE');
   const raw=await readBoundedResponseText(response,25_000_000);
   let result:T; try { result=JSON.parse(raw) as T; } catch { throw new Error('GOVERNMENT_SOURCE_INVALID_JSON'); }
   const outputHash=sha256(result);
   const retrievedAt=new Date().toISOString();
   return {result,traceId,hash:outputHash,citations:[{url:requested.toString(),title:source.title,retrievedAt}],evidence:[{sourceId:source.id,authority:source.authority,retrievedAt,sha256:sha256(raw),mediaType}],provenance:{traceId,provider:source.id,providerVersion:'1',generatedAt,inputHash,outputHash,status:'UNVERIFIED'},hashes:{input:inputHash,output:outputHash}};
 } finally {clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
}
export function validateEvidenceEnvelope(value:EvidenceEnvelope<unknown>):readonly string[] {
 const errors:string[]=[];
 if(!value||typeof value!=='object')return ['evidence envelope must be an object'];
 const provenance=value.provenance;
 const hashes=value.hashes;
 const hashPattern=/^[a-f0-9]{64}$/;
 if(typeof value.traceId!=='string'||!value.traceId.trim()||!provenance||value.traceId!==provenance.traceId)errors.push('traceId is required and must match provenance');
 if(!provenance||typeof provenance.provider!=='string'||!provenance.provider.trim())errors.push('provider is required');
 if(!provenance||typeof provenance.providerVersion!=='string'||!provenance.providerVersion.trim())errors.push('providerVersion is required');
 if(!provenance||!Number.isFinite(Date.parse(provenance.generatedAt)))errors.push('generatedAt must be a valid timestamp');
 if(!provenance||!['VALIDATED','UNVERIFIED','UNAVAILABLE','REJECTED'].includes(provenance.status))errors.push('evidence status is invalid');
 if(!hashes||!hashPattern.test(hashes.input)||!hashPattern.test(hashes.output))errors.push('SHA-256 hashes must be lowercase 64-character hex');
 if(typeof value.hash!=='string'||!hashPattern.test(value.hash)||value.hash!==hashes?.output)errors.push('hash must match normalized output hash');
 if(provenance&&hashes&&provenance.inputHash!==hashes.input)errors.push('input hash does not match provenance');
 if(provenance&&hashes&&provenance.outputHash!==hashes.output)errors.push('output hash does not match provenance');
 if(hashes&&hashPattern.test(hashes.output)) {
  try {if(sha256(value.result)!==hashes.output)errors.push('output hash does not match result');}
  catch {errors.push('result must be canonical JSON-compatible data');}
 }
 if(!Array.isArray(value.evidence)||value.evidence.length===0)errors.push('at least one evidence record is required');
 for(const record of Array.isArray(value.evidence)?value.evidence:[]) {
  if(!record||typeof record!=='object'){errors.push('evidence records must be objects');continue;}
  if(!hashPattern.test(record.sha256))errors.push('evidence SHA-256 must be lowercase 64-character hex');
  if(typeof record.mediaType!=='string'||!record.mediaType.trim())errors.push('evidence mediaType is required');
  if(!Number.isFinite(Date.parse(record.retrievedAt)))errors.push('evidence retrievedAt must be a valid timestamp');
  try {if(getGovernmentSource(record.sourceId).authority!==record.authority)errors.push('evidence authority does not match source registry');}
  catch {errors.push('evidence sourceId is not registered');}
 }
 if(!Array.isArray(value.citations)||value.citations.length===0)errors.push('at least one citation is required');
 for(const citation of Array.isArray(value.citations)?value.citations:[]) {
  if(!citation||typeof citation!=='object'){errors.push('citations must be objects');continue;}
  try {const url=new URL(citation.url);if(url.protocol!=='https:'||url.username||url.password)errors.push('citations must use credential-free HTTPS');}
  catch {errors.push('citations must contain valid URLs');}
  if(!Number.isFinite(Date.parse(citation.retrievedAt)))errors.push('citation retrievedAt must be a valid timestamp');
 }
 return errors;
}

export { SourceAuthorityLevel, getRegisteredGovernmentSource, validateGovernmentSourceRegistry } from './GovernmentSourceRegistry.ts';
export type { GovernmentSource as RegisteredGovernmentSource } from './GovernmentSourceRegistry.ts';
export { DatasetValidator } from './validators/DatasetValidator.ts';
export { GeometryValidator, SUPPORTED_GEOMETRY_TYPES } from './validators/GeometryValidator.ts';
export { MetadataValidator } from './validators/MetadataValidator.ts';
