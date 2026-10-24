import { randomUUID } from 'node:crypto';
import { queryGovernmentJson, sha256, type EvidenceEnvelope } from '../index.ts';

export interface NwsFloodInundationAdapterOptions {
 signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch;
}
export interface FimForecastProduct {
 readonly name:string;
 readonly basis:string;
 readonly extent:string;
}
export interface FimForecastDiscovery {
 readonly products:readonly FimForecastProduct[];
 readonly coverageClaim:string;
 /** Direct REST query for the dynamic layers: 'UNAVAILABLE' until the exact service URL is pinned. */
 readonly directQuery:'UNAVAILABLE';
 readonly directQueryReason:string;
 readonly livingAtlas:string;
}
export interface FimPlatformTerms {
 readonly dataLicense:string;
 readonly platformTerms:string;
}
export interface FimAoiCheck {
 /** Direct dynamic-layer query for the AOI: 'UNAVAILABLE' (URL not pinned); coverage is an UNVERIFIED cited claim, never a verified availability. */
 readonly directQuery:'UNAVAILABLE';
 readonly coverageClaim:string;
 readonly reason:string;
 readonly verifyVia:readonly string[];
}

const STATIC_CATFIM_SERVICE='https://maps.water.noaa.gov/server/rest/services/fim_libs/static_stage_based_catfim/FeatureServer';
const OWP_OPERATIONS_URL='https://www.weather.gov/owp/operations';
const FIM_FLYER_URL='https://www.weather.gov/media/owp/operations/NWS_OWP_FIM_Flyer.pdf';
const NWS_GIS_VIEWER_URL='https://viewer.weather.noaa.gov/water';
const NWPS_URL='https://water.noaa.gov';
/** Checked-in knowledge statement date; re-verify via getStaticServiceMetadata(). */
const STATEMENT_DATE='2026-10-23T00:00:00Z';
const sourceTitle='NWS flood inundation mapping (FIM)';

function localEnvelope<T>(result:T,title:string,url:string,status:'UNVERIFIED'):EvidenceEnvelope<T> {
 const traceId=randomUUID();
 const outputHash=sha256(result);
 const inputHash=sha256({sourceId:'nws-flood-inundation',title});
 return {
  result,traceId,hash:outputHash,
  citations:[{url,title:sourceTitle+' — '+title,retrievedAt:STATEMENT_DATE}],
  evidence:[{sourceId:'nws-flood-inundation',authority:'NOAA',retrievedAt:STATEMENT_DATE,sha256:outputHash,mediaType:'application/json'}],
  provenance:{traceId,provider:'nws-flood-inundation',providerVersion:'1',generatedAt:new Date().toISOString(),inputHash,outputHash,status},
  hashes:{input:inputHash,output:outputHash},
 };
}

/**
 * NOAA/NWS flood inundation mapping (FIM).
 *
 * Data: public domain (NWS/NOAA federal works). Platform: the direct NOAA
 * ArcGIS REST endpoint below needs NO API key. Copies of these layers also
 * appear in Esri ArcGIS Living Atlas — Esri platform terms apply to the
 * hosted copy (its terms of use, and any named-user/token or subscription
 * requirement on a given item); the data themselves remain public domain.
 *
 * What is pinned here: the static stage-based categorical FIM library
 * (experimental; planning reference only — not for navigation, permitting, or
 * other legal purposes), a per-gauge HAND-derived service keyed by NWSLI.
 * What is NOT pinned: the near-real-time dynamic layers (NWM hourly current
 * analysis, NWM 5-day forecast, RFC 5-day forecast) — their exact REST
 * service URL is not pinned in this checkout, so getForecastLayers() and
 * checkAOI() report directQuery='UNAVAILABLE' with discovery pointers
 * (NWPS, NWS GIS viewer, Living Atlas) instead of fabricating endpoints.
 *
 * Live methods (getStaticServiceMetadata) perform network fetches and are for
 * USER-INITIATED use only, per the river-data policy (no polling, no
 * background refresh).
 */
export class NwsFloodInundationAdapter {
 readonly sourceId='nws-flood-inundation';
 readonly endpoint=STATIC_CATFIM_SERVICE;
 async getStaticServiceMetadata(options:NwsFloodInundationAdapterOptions={}):Promise<EvidenceEnvelope<Record<string,unknown>>> {
  return queryGovernmentJson(this.sourceId,this.endpoint+'?f=pjson',options);
 }
 getForecastLayers():EvidenceEnvelope<FimForecastDiscovery> {
  return localEnvelope<FimForecastDiscovery>({
   products:[
    {name:'NWM hourly analysis — current conditions',basis:'National Water Model streamflow analysis',extent:'Lower 48 + parts of south-central Alaska'},
    {name:'NWM 5-day inundation forecast',basis:'National Water Model streamflow prediction',extent:'Lower 48 + parts of south-central Alaska'},
    {name:'RFC 5-day inundation forecast',basis:'NWS River Forecast Center streamflow forecasts, at/downstream of official RFC forecast locations',extent:'Lower 48 + parts of south-central Alaska'},
    {name:'Static categorical FIM (CatFIM)',basis:'Official NWS category thresholds via Height Above Nearest Drainage (HAND)',extent:'Select NWS river forecast points (per-gauge static library)'},
   ],
   coverageClaim:'NWS Sept 2026 announcement: FIM expanded to nearly 100% of the U.S. population (excludes northern/western Alaska, Guam, CNMI, American Samoa) — cited claim, UNVERIFIED from this checkout.',
   directQuery:'UNAVAILABLE',
   directQueryReason:'The exact REST service URL for the dynamic current/RFC-5-day layers is not pinned in this checkout; verify via the NWS GIS viewer ('+NWS_GIS_VIEWER_URL+') or NWPS ('+NWPS_URL+') before operational use. Not approximated, not fabricated.',
   livingAtlas:'NOAA flood inundation map services are visible in Esri ArcGIS Living Atlas (current analysis, RFC forecast, NBM 5-day layers, per Esri/Living Atlas presentation). Esri platform terms apply to the hosted copy; data remain public domain.',
  },'near-real-time FIM product discovery',OWP_OPERATIONS_URL,'UNVERIFIED');
 }
 getPlatformTerms():EvidenceEnvelope<FimPlatformTerms> {
  return localEnvelope<FimPlatformTerms>({
   dataLicense:'Public domain (NOAA/NWS federal works).',
   platformTerms:'Esri ArcGIS Living Atlas / ArcGIS Online hosted copies are served under Esri platform terms: a named-user token or subscription may be required for some items or heavy use. The direct NOAA endpoint ('+STATIC_CATFIM_SERVICE+') requires no API key. See '+FIM_FLYER_URL+' and '+OWP_OPERATIONS_URL+'.',
  },'data license and platform terms',FIM_FLYER_URL,'UNVERIFIED');
 }
 checkAOI():EvidenceEnvelope<FimAoiCheck> {
  return localEnvelope<FimAoiCheck>({
   directQuery:'UNAVAILABLE',
   coverageClaim:'NWS Sept 2026 announcement: FIM covers nearly 100% of the U.S. population (Lower 48 + parts of south-central Alaska) — cited claim, UNVERIFIED from this checkout; tri-state AOI coverage NOT independently verified here.',
   reason:'Direct dynamic-layer query is UNAVAILABLE (service URL not pinned); AOI coverage is reported only as a cited, unverified claim — never as a verified availability, never approximated.',
   verifyVia:[NWS_GIS_VIEWER_URL,NWPS_URL,OWP_OPERATIONS_URL],
  },'AOI availability check (tri-state AOI)',OWP_OPERATIONS_URL,'UNVERIFIED');
 }
}
