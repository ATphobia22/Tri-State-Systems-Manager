import type {Map as MapLibreMap} from 'maplibre-gl';
import {ensureProtocolRegistered} from './pmtiles-overlay';
import {toPmtilesSourceUrl} from './pmtiles-fabric';
import {registerGovernmentVectorLayer, type GovernmentTileManifest} from '../../../packages/government/src/layers/maplibreGovernmentLayers';
import {
  isVerifiedHistoricalSnapshot, parseGovDate, parseTrustedMerkleRoots,
  snapshotIsStale, type GovernmentSnapshotDescriptor, type GovernmentReleaseReceipt,
  type GovernmentSnapshotPresentation
} from './government-snapshot-policy';

/** Display resilience, not relaxation of numerical/regulatory approval gates.
 *
 * Historical archives are accepted only when:
 * - the source, snapshot date and agency are explicit;
 * - source and archive digests match the staged verification receipt;
 * - its Merkle root is pinned by the reviewed application build;
 * - the resulting archive URL is reachable.
 *
 * Never fabricate data, elevations or a "current" FEMA designation. The 3D
 * camera and all independent layers continue when these checks do not pass.
 */
type AvailableArchive = GovernmentSnapshotDescriptor & {historical: boolean};
type SourceEvent = {
  status: GovernmentSnapshotPresentation;
  source: string|null;
  capturedAt: string|null;
  agency: string|null;
  merkleRootSha256: string|null;
  authoritativeEngineeringUse: false;
  regulatoryApproval: false;
};
const SHA=/^[0-9a-f]{64}$/;

function validArchiveUrl(raw:string):string{
  if(!raw||/\s/.test(raw))throw Error('GOVERNMENT_ARCHIVE_INVALID_URL');
  const url=new URL(raw,window.location.href);
  if(url.username||url.password||url.protocol!=='https:')
    throw Error('GOVERNMENT_ARCHIVE_REQUIRES_HTTPS');
  return url.toString();
}

function environmentFallbacks():AvailableArchive[]{
  const config=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_FALLBACKS?.trim();
  if(!config)return [];
  try {
    const values:unknown=JSON.parse(config);
    if(!Array.isArray(values)||values.length>20)throw Error('GOVERNMENT_FALLBACK_CATALOG_INVALID');
    const entries=values.map((value:unknown):AvailableArchive=>{
      if(!value||typeof value!=='object')throw Error('GOVERNMENT_FALLBACK_ITEM_INVALID');
      const item=value as Record<string,unknown>;
      for(const key of ['manifestUrl','archiveUrl','agency','capturedAt','sourceRecordUrl']){
        if(typeof item[key]!=='string'||!(item[key] as string).trim())
          throw Error('GOVERNMENT_FALLBACK_FIELD_REQUIRED:'+key);
      }
      const entry=item as unknown as GovernmentSnapshotDescriptor;
      validArchiveUrl(entry.manifestUrl);
      validArchiveUrl(entry.archiveUrl);
      if(!Number.isFinite(parseGovDate(entry.capturedAt)))
        throw Error('GOVERNMENT_FALLBACK_CAPTURE_TIME_INVALID');
      return {...entry,historical:true};
    });
    return entries.sort((a,b)=>parseGovDate(b.capturedAt)-parseGovDate(a.capturedAt));
  }catch(error){
    console.warn('Government fallback catalog invalid; base and 3D layers remain available.',error);
    return [];
  }
}

function announce(event:SourceEvent):void{
  window.dispatchEvent(new CustomEvent<SourceEvent>('tsm:government-scene-status',{detail:event}));
}

function statusDetail(
  status:GovernmentSnapshotPresentation,
  context?:AvailableArchive,
  root?:string
):SourceEvent{
  return {
    status,source:context?.sourceRecordUrl??null,
    capturedAt:context?.capturedAt??null,
    agency:context?.agency??null,
    merkleRootSha256:root??null,
    authoritativeEngineeringUse:false,
    regulatoryApproval:false,
  };
}

async function archiveReachable(url:string,signal:AbortSignal):Promise<boolean>{
  // Byte-range probe avoids downloading an entire PMTiles archive at startup.
  // CORS/HTTP failures are isolated to this optional source, not the map.
  const res=await fetch(url,{signal,redirect:'error',headers:{Range:'bytes=0-0'}});
  if(res.body)await res.body.cancel();
  return (res.status===206||res.status===200)&&res.ok;
}

export function attachGovernmentPmtilesLayer(map:MapLibreMap):()=>void{
  const metadata=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_MANIFEST?.trim();
  const archive=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_URL?.trim();
  const roots=parseTrustedMerkleRoots(import.meta.env.VITE_TSM_GOVERNMENT_TRUSTED_MERKLE_ROOTS);
  const sources:AvailableArchive[]=[];
  if(metadata&&archive)sources.push({
    manifestUrl:metadata,archiveUrl:archive,
    agency:'',capturedAt:'',sourceRecordUrl:'',historical:false
  });
  sources.push(...environmentFallbacks());
  const controller=new AbortController();
  let sourceId:string|null=null,layerId:string|null=null;
  (async()=>{
    for(const source of sources){
      if(controller.signal.aborted)return;
      try{
        const manifestUrl=validArchiveUrl(source.manifestUrl);
        const archiveUrl=validArchiveUrl(source.archiveUrl);
        const response=await fetch(manifestUrl,{signal:controller.signal,redirect:'error'});
        if(!response.ok)throw Error('GOVERNMENT_MANIFEST_HTTP_'+response.status);
        const body=await response.text();
        if(body.length>100_000)throw Error('GOVERNMENT_MANIFEST_TOO_LARGE');
        const manifest=JSON.parse(body) as GovernmentTileManifest & GovernmentReleaseReceipt;
        if(!SHA.test(manifest.tilesSha256)||!SHA.test(manifest.sourceSha256))
          throw Error('GOVERNMENT_MANIFEST_DIGEST_INVALID');

        // A configured "current" archive must carry dated provenance.
        // Stale or undated current data are not displayed as live/current.
        const snapshotTime=manifest.capturedAt??manifest.acquiredAt??'';
        const stale=snapshotIsStale(snapshotTime);
        const historical=source.historical||stale;
        const context:AvailableArchive=source.historical
          ?source:{...source,capturedAt:snapshotTime,agency:manifest.attribution,sourceRecordUrl:manifestUrl,historical:stale};
        if(historical && !isVerifiedHistoricalSnapshot(context,manifest,Date.now(),roots))
          throw Error('GOVERNMENT_HISTORICAL_RELEASE_PROOF_NOT_VERIFIED');
        if(!(await archiveReachable(archiveUrl,controller.signal)))
          throw Error('GOVERNMENT_ARCHIVE_NOT_REACHABLE');

        if(controller.signal.aborted)return;
        ensureProtocolRegistered();
        const sourceUrl=toPmtilesSourceUrl({
          id:'government-offline',archiveUrl,attribution:manifest.attribution,enabled:true
        });
        const ids=registerGovernmentVectorLayer(map as never,{
          id:'tsm_authoritative',archiveUrl:sourceUrl,manifest,
          visible:true,color:historical?'#ad9141':'#117f9b'
        });
        sourceId=ids.sourceId;layerId=ids.layerId;
        announce(statusDetail(historical?'HISTORICAL_GOVERNMENT_FALLBACK':'CURRENT_GOVERNMENT_SNAPSHOT',
                              context,manifest.merkleRootSha256));
        return;
      }catch(error){
        if(!controller.signal.aborted)
          console.warn('Government layer unavailable; trying an archived snapshot without stopping the 3D twin.',error);
      }
    }
    if(!controller.signal.aborted)announce(statusDetail('NO_GOVERNMENT_SNAPSHOT'));
  })();
  return ()=>{
    controller.abort();
    try{
      if(layerId&&map.getLayer(layerId))map.removeLayer(layerId);
      if(sourceId&&map.getSource(sourceId))map.removeSource(sourceId);
    }catch{/* The parent map may already be disposed. */}
  };
}
