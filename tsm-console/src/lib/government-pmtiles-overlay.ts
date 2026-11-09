import type { Map as MapLibreMap } from 'maplibre-gl';
import { ensureProtocolRegistered } from './pmtiles-overlay';
import { toPmtilesSourceUrl } from './pmtiles-fabric';
import { registerGovernmentVectorLayer, type GovernmentTileManifest } from '../../../packages/government/src/layers/maplibreGovernmentLayers';

/** Optional, explicitly staged, public government vector tile overlay.
 * It never fetches agency data from the map and never silently invents missing layers.
 */
export function attachGovernmentPmtilesLayer(map:MapLibreMap):()=>void {
 const manifestUrl=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_MANIFEST?.trim();
 const archiveUrl=import.meta.env.VITE_TSM_GOVERNMENT_PMTILES_URL?.trim();
 if(!manifestUrl||!archiveUrl)return ()=>undefined;
 const abort=new AbortController();
 let layerId:string|null=null,sourceId:string|null=null;
 (async()=>{
  try {
   // Require the archive and its manifest to be immutable and HTTPS hosted.
   const manifestAddress=new URL(manifestUrl);
   const archiveAddress=new URL(archiveUrl);
   if(manifestAddress.protocol!=='https:'||archiveAddress.protocol!=='https:')throw Error('GOVERNMENT_ARCHIVE_REQUIRES_HTTPS');
   const res=await fetch(manifestAddress.toString(),{signal:abort.signal,redirect:'error'});
   if(!res.ok)throw Error('GOVERNMENT_MANIFEST_HTTP_'+res.status);
   const body=await res.text();
   if(body.length>100_000)throw Error('GOVERNMENT_MANIFEST_TOO_LARGE');
   const manifest=JSON.parse(body) as GovernmentTileManifest;
   if(abort.signal.aborted)return;
   ensureProtocolRegistered();
   const sourceUrl=toPmtilesSourceUrl({id:manifest.datasetId,archiveUrl:archiveAddress.toString(),attribution:manifest.attribution,enabled:true});
   const ids=registerGovernmentVectorLayer(map as never,{
    id:'tsm_authoritative',archiveUrl:sourceUrl,manifest,
    visible:true,color:'#117f9b'
   });
   sourceId=ids.sourceId;layerId=ids.layerId;
  }catch(error) {
   if(!abort.signal.aborted)console.warn('Government PMTiles layer unavailable; no substituted data.',error);
  }
 })();
 return()=>{
  abort.abort();
  try {
   if(layerId&&map.getLayer(layerId))map.removeLayer(layerId);
   if(sourceId&&map.getSource(sourceId))map.removeSource(sourceId);
  }catch {/* MapLibre map may already have been disposed. */}
 };
}
