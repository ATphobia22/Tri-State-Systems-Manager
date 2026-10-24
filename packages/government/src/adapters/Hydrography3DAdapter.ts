import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface Hydrography3DAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}
export interface ThreeDHPNewCoverage {
 /** HUC8 of the only 3DEP-aligned elevation-derived release: '0601010403'. */
 readonly hydrologicUnit:string;
 readonly area:string;
 readonly note:string;
}
export interface ThreeDHPCoverage {
 readonly serviceUrl:string;
 readonly announcementUrl:string;
 readonly new3depAlignedCoverage:ThreeDHPNewCoverage;
 readonly legacyIntegration:string;
 readonly license:string;
 readonly triStateNote:string;
}
export interface ThreeDHPAoiCheck {
 readonly huc8:string;
 readonly status:'COVERED'|'UNAVAILABLE';
 readonly reason:string;
 readonly new3depAlignedCoverage:ThreeDHPNewCoverage;
}

const SERVICE_URL='https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer';
const ANNOUNCEMENT_URL='https://www.usgs.gov/3d-hydrography-program/news/usgs-announces-release-updated-3d-hydrography-program-data-service';
const ACCESS_PAGE_URL='https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products';
/** Checked-in knowledge statement date; re-verify via getServiceMetadata(). */
const STATEMENT_DATE='2026-10-23T00:00:00Z';
const NEW_COVERAGE:ThreeDHPNewCoverage={
 hydrologicUnit:'0601010403',
 area:'Holston River area near Knoxville, Tennessee',
 note:'First new hydrography data published by the 3DHP aligned with 3DEP lidar; includes Mainstem IDs and Flow Network Derivatives. Added to the service in the July 2026 release per USGS (EDH data are added quarterly).',
};

function localEnvelope<T>(result:T,title:string,url:string,status:'UNVERIFIED'|'UNAVAILABLE'):EvidenceEnvelope<T> {
 const traceId=randomUUID();
 const outputHash=sha256(result);
 return {
  result,traceId,hash:outputHash,
  citations:[{url,title:sourceTitle+' — '+title,retrievedAt:STATEMENT_DATE}],
  evidence:[{sourceId:'usgs-3dhp',authority:'USGS',retrievedAt:STATEMENT_DATE,sha256:outputHash,mediaType:'application/json'}],
  provenance:{traceId,provider:'usgs-3dhp',providerVersion:'1',generatedAt:new Date().toISOString(),inputHash:sha256({sourceId:'usgs-3dhp',title}),outputHash,status},
  hashes:{input:sha256({sourceId:'usgs-3dhp',title}),output:outputHash},
 };
}
const sourceTitle='USGS 3D Hydrography Program — updated 3DHP data service (Oct 2026 announcement)';

/**
 * USGS 3D Hydrography Program (3DHP) updated data service.
 *
 * Public-domain federal data; no API key. The updated service carries the
 * first 3DEP-aligned elevation-derived hydrography (EDH): at release that
 * new data cover ONLY HUC 0601010403 (Holston River area, near Knoxville TN);
 * the surrounding area is the retired National Hydrography Dataset integrated
 * for context. EDH is added quarterly, so coverage grows over time — call
 * getServiceMetadata() to re-check, or getCoverage() for the checked-in
 * statement (provenance UNVERIFIED until re-checked).
 *
 * HONEST COVERAGE: checkAOI() reports UNAVAILABLE (never approximated, never
 * fabricated) for any AOI outside HUC 0601010403, including the tri-state
 * Ohio–Wabash AOI.
 *
 * Live methods (getServiceMetadata/getLayerMetadata) perform network fetches
 * and are for USER-INITIATED use only, per the river-data policy (no polling,
 * no background refresh).
 */
export class Hydrography3DAdapter {
 readonly sourceId='usgs-3dhp';
 readonly endpoint=SERVICE_URL;
 /** The only HUC8 with new 3DEP-aligned 3DHP elevation-derived data at release. */
 static readonly NEW_EDH_HUC8='0601010403';
 getCoverage():EvidenceEnvelope<ThreeDHPCoverage> {
  return localEnvelope<ThreeDHPCoverage>({
   serviceUrl:SERVICE_URL,
   announcementUrl:ANNOUNCEMENT_URL,
   new3depAlignedCoverage:NEW_COVERAGE,
   legacyIntegration:'Outside the Holston River area the service carries older data from the retired National Hydrography Dataset (NHD/WBD/NHDPlus HR are legacy reference products since 2024; see '+ACCESS_PAGE_URL+').',
   license:'Public Domain (USGS).',
   triStateNote:'The tri-state Ohio–Wabash AOI has NO new 3DEP-aligned 3DHP coverage; checkAOI() returns UNAVAILABLE for it. Use legacy NHD reference products or wait for quarterly EDH releases.',
  },'checked-in coverage statement',ANNOUNCEMENT_URL,'UNVERIFIED');
 }
 checkAOI(huc8?:string):EvidenceEnvelope<ThreeDHPAoiCheck> {
  const requested=huc8??'tri-state Ohio–Wabash AOI';
  const covered=huc8===Hydrography3DAdapter.NEW_EDH_HUC8;
  const reason=covered
   ?'HUC 0601010403 (Holston River area, near Knoxville TN) is the only area with new 3DEP-aligned 3DHP elevation-derived data per the USGS Oct 2026 service announcement.'
   :'The current 3DEP-aligned 3DHP release covers only HUC 0601010403 (Holston River area, near Knoxville TN). "'+requested+'" is outside that coverage, so no current 3DHP elevation-derived hydrography is available for it. Reported UNAVAILABLE — not approximated, not fabricated. Surrounding areas carry legacy retired-NHD data for context only (Holston area), which is not new elevation-derived hydrography.';
  return localEnvelope<ThreeDHPAoiCheck>({
   huc8:requested,status:covered?'COVERED':'UNAVAILABLE',reason,new3depAlignedCoverage:NEW_COVERAGE,
  },'AOI coverage check for "'+requested+'"',ANNOUNCEMENT_URL,covered?'UNVERIFIED':'UNAVAILABLE');
 }
 async getServiceMetadata(options:Hydrography3DAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'?f=pjson',options);
 }
 async getLayerMetadata(layer:number|string,options:Hydrography3DAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  const id=typeof layer==='string'?Number(layer):layer;
  if(!Number.isInteger(id)||id<0)throw new Error('3DHP_LAYER_INVALID:'+String(layer));
  return queryGovernmentJson(this.sourceId,this.endpoint+'/'+id+'?f=pjson',options);
 }
}
