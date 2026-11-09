/** MapLibre government vector-tile wiring.
 * Call after registering `pmtiles` protocol with maplibre.addProtocol('pmtiles',new Protocol().tile).
 * Sources are offline snapshot archives: never silently fall back to live/synthetic layers.
 */
export interface GovernmentTileManifest {
 datasetId:string;
 tilesSha256:string;
 sourceSha256:string;
 layer:string;
 classification:string;
 validation:string;
 attribution:string;
 horizontalCrs:string;
}
interface MapLike {
 getSource(id:string):unknown;
 getLayer(id:string):unknown;
 addSource(id:string,source:Record<string,unknown>):void;
 addLayer(layer:Record<string,unknown>):void;
 setLayoutProperty(id:string,name:string,value:unknown):void;
}
const SAFE_ID=/^[a-z][a-z0-9_-]{0,63}$/;
export function registerGovernmentVectorLayer(
 map:MapLike,
 input:{id:string;archiveUrl:string;manifest:GovernmentTileManifest;visible?:boolean;color?:string}
):{sourceId:string;layerId:string} {
 const {id,archiveUrl,manifest}=input;
 if(!SAFE_ID.test(id)||!SAFE_ID.test(manifest.layer))throw new Error('GOVERNMENT_TILE_ID_INVALID');
 if(!/^([a-f0-9]{64})$/.test(manifest.tilesSha256)||!/^([a-f0-9]{64})$/.test(manifest.sourceSha256))
   throw new Error('GOVERNMENT_TILE_HASH_MISSING');
 if(manifest.validation!=='VERIFIED'&&manifest.validation!=='BUILT_NOT_FIELD_VERIFIED')throw new Error('GOVERNMENT_TILE_NOT_VALIDATED');
 if(manifest.horizontalCrs!=='EPSG:4326'||!manifest.attribution)throw new Error('GOVERNMENT_TILE_METADATA_MISSING');
 if(manifest.classification==='SCENARIO_SIMULATION_DEMO')throw new Error('GOVERNMENT_TILE_SCENARIO_NOT_AUTHORITY');
 // Caller must point at an explicitly staged local or pinned HTTPS tile archive.
 if(!archiveUrl.startsWith('pmtiles://')||/\s/.test(archiveUrl))throw new Error('GOVERNMENT_TILE_PROTOCOL_REQUIRED');
 const sourceId='government-'+id,layerId=sourceId+'-fill';
 if(!map.getSource(sourceId))map.addSource(sourceId,{type:'vector',url:archiveUrl,attribution:manifest.attribution});
 if(!map.getLayer(layerId))map.addLayer({id:layerId,type:'fill',source:sourceId,'source-layer':manifest.layer,
  layout:{visibility:input.visible?'visible':'none'},
  paint:{'fill-color':input.color??'#1f8fb5','fill-opacity':0.22}});
 else map.setLayoutProperty(layerId,'visibility',input.visible?'visible':'none');
 return {sourceId,layerId};
}
