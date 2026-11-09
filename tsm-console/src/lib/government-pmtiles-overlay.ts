import type {Map as MapLibreMap} from 'maplibre-gl';
import {ensureProtocolRegistered} from './pmtiles-overlay';
import {toPmtilesSourceUrl} from './pmtiles-fabric';
import {registerGovernmentVectorLayer, type GovernmentTileManifest} from '../../../packages/government/src/layers/maplibreGovernmentLayers';

/**
 * Presentation-level resilience only. A failed live service does NOT take down the
 * map: select the most recent available hash-pinned older government snapshot.
 * This is not permission to invent elevations, change effective FEMA designations,
 * or turn old planning data into a current regulatory determination.
 *
 * VITE_TSM_GOVERNMENT_PMTILES_FALLBACKS accepts a JSON array of:
 * {manifestUrl, archiveUrl, agency, capturedAt, sourceRecordUrl}.
 * The archived manifest must carry source and tile SHA-256s and attribution.
 */
type SnapshotFallback = {
  manifestUrl: string;
  archiveUrl: string;
  agency: string;
  capturedAt: string;
  sourceRecordUrl: string;
};
type SceneSourceStatus = 'CURRENT_GOVERNMENT_SNAPSHOT'|'HISTORICAL_GOVERNMENT_FALLBACK'|'NO_GOVERNMENT_SNAPSHOT';
const SHA = /^[0-9a-f]{64}$/;
const APPROVED_AGENCIES = new Set([
  'FEMA','USGS','NOAA','USACE','INDIANA GIO','INDIANA DNR',
  'ILLINOIS DNR','KENTUCKY GIS','NWS',
]);

function safeAssetUrl(value:string): string {
  if(!value || /\s/.test(value)) throw Error('GOVERNMENT_ARCHIVE_URL_MALFORMED');
  const target = new URL(value, window.location.href);
  if(target.username || target.password) throw Error('GOVERNMENT_ARCHIVE_CREDENTIAL_URL_FORBIDDEN');
  if(target.protocol !== 'https:' && !(target.origin === window.location.origin && target.protocol === 'http:'))
    throw Error('GOVERNMENT_ARCHIVE_SOURCE_MUST_BE_HTTPS_OR_LOCAL');
  return target.toString();
}

function fallbacksFromEnvironment():SnapshotFallback[] {
  const text = import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_FALLBACKS?.trim();
  if(!text) return [];
  try {
    const entries:unknown = JSON.parse(text);
    if(!Array.isArray(entries) || entries.length > 20) throw Error('GOVERNMENT_ARCHIVE_FALLBACK_LIST_INVALID');
    const valid = entries.map((raw:unknown):SnapshotFallback=>{
      if(!raw || typeof raw !== 'object') throw Error('GOVERNMENT_ARCHIVE_ENTRY_REQUIRED');
      const value = raw as Record<string,unknown>;
      for(const key of ['manifestUrl','archiveUrl','agency','capturedAt','sourceRecordUrl'])
        if(typeof value[key]!=='string' || !(value[key] as string).trim())
          throw Error('GOVERNMENT_ARCHIVE_ENTRY_FIELD_REQUIRED:'+key);
      const row = value as SnapshotFallback;
      if(!APPROVED_AGENCIES.has(row.agency.trim().toUpperCase()))throw Error('GOVERNMENT_ARCHIVE_AGENCY_NOT_ALLOWLISTED');
      const source = new URL(row.sourceRecordUrl);
      if(source.protocol !== 'https:' || source.username || source.password)
        throw Error('GOVERNMENT_ARCHIVE_SOURCE_RECORD_NOT_HTTPS');
      if(!Number.isFinite(Date.parse(row.capturedAt)) || new Date(row.capturedAt).getTime() > Date.now())
        throw Error('GOVERNMENT_ARCHIVE_CAPTURE_DATE_INVALID');
      safeAssetUrl(row.manifestUrl);
      safeAssetUrl(row.archiveUrl);
      return row;
    });
    return valid.sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
  } catch(error) {
    console.warn('Historical government PMTiles catalog invalid; map continues without those layers.',error);
    return [];
  }
}

function announce(status:SceneSourceStatus, context?:SnapshotFallback):void {
  // Consumers can display historical badge, source, acquisition date and limits.
  // No regulatory or hydraulic authorization is inferred from this status.
  window.dispatchEvent(new CustomEvent('tsm:government-scene-status',{
    detail:{status, source:context?.sourceRecordUrl??null, capturedAt:context?.capturedAt??null,
      authoritativeEngineeringUse:false, regulatoryApproval:false},
  }));
}

/** Attach current layer or the newest pinned older official-source snapshot.
 * Source failure never blocks the rest of the digital twin.
 */
export function attachGovernmentPmtilesLayer(map:MapLibreMap):()=>void {
  const manifestUrl=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_MANIFEST?.trim();
  const archiveUrl=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_URL?.trim();
  const fallbackList=fallbacksFromEnvironment();
  const sources:[string,string,SnapshotFallback|undefined][]=[];
  if(manifestUrl&&archiveUrl) sources.push([manifestUrl,archiveUrl,undefined]);
  for(const entry of fallbackList) sources.push([entry.manifestUrl,entry.archiveUrl,entry]);
  const abort=new AbortController();
  let layerId:string|null=null,sourceId:string|null=null;
  (async()=>{
    for(const [metadata,archive,context] of sources) {
      if(abort.signal.aborted) return;
      try {
        const manifestAddress=safeAssetUrl(metadata);
        const archiveAddress=safeAssetUrl(archive);
        const response=await fetch(manifestAddress,{signal:abort.signal,redirect:'error'});
        if(!response.ok) throw Error('GOVERNMENT_MANIFEST_HTTP_'+response.status);
        const body=await response.text();
        if(body.length>100_000) throw Error('GOVERNMENT_MANIFEST_TOO_LARGE');
        const manifest=JSON.parse(body) as GovernmentTileManifest;
        if(!SHA.test(manifest.tilesSha256)||!SHA.test(manifest.sourceSha256))
          throw Error('GOVERNMENT_MERKLE_SOURCE_HASH_MISSING');
        if(abort.signal.aborted) return;
        ensureProtocolRegistered();
        const sourceUrl=toPmtilesSourceUrl({
          id:'government-offline',
          archiveUrl:archiveAddress,
          attribution:manifest.attribution,
          enabled:true
        });
        const ids=registerGovernmentVectorLayer(map as never,{
          id:'tsm_authoritative',archiveUrl:sourceUrl,manifest,
          visible:true,color:context?'#ad9141':'#117f9b'
        });
        sourceId=ids.sourceId; layerId=ids.layerId;
        announce(context?'HISTORICAL_GOVERNMENT_FALLBACK':'CURRENT_GOVERNMENT_SNAPSHOT',context);
        return;
      } catch(error) {
        if(!abort.signal.aborted)console.warn('Government snapshot not usable, attempting another dated archive.',error);
      }
    }
    if(!abort.signal.aborted)announce('NO_GOVERNMENT_SNAPSHOT');
  })();
  return()=>{
    abort.abort();
    try {
      if(layerId&&map.getLayer(layerId))map.removeLayer(layerId);
      if(sourceId&&map.getSource(sourceId))map.removeSource(sourceId);
    }catch{/* MapLibre map may already be disposed. */}
  };
}
