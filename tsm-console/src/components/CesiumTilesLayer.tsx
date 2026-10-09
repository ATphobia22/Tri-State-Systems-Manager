import { useEffect, useRef, useState } from 'react';

interface Tileset { destroy(): void }
interface Primitives { add(tileset: Tileset): Tileset }
interface Scene { primitives: Primitives }
interface Viewer { scene: Scene; zoomTo(target: Tileset): Promise<boolean>; destroy(): void }
interface CesiumApi { Viewer: new (container: HTMLElement, options: Record<string, unknown>) => Viewer; Cesium3DTileset: { fromUrl(url: string): Promise<Tileset> } }

declare global { interface Window { Cesium?: unknown; CESIUM_BASE_URL?: string } }

interface CesiumTilesLayerProps {
  readonly tilesetUrl: string;
  readonly cesiumBaseUrl?: string;
  readonly onStatusChange?: (status:'loading'|'ready'|'error'|'disabled')=>void;
}

function isCesium(value: unknown): value is CesiumApi {
  if(typeof value!=='object'||value===null)return false;
  const r=value as Record<string,unknown>, c=r.Cesium3DTileset;
  return typeof r.Viewer==='function'&&typeof c==='object'&&c!==null&&typeof (c as Record<string,unknown>).fromUrl==='function';
}
function normalize(url:string):string{return url.endsWith('/')?url:`${url}/`}
async function loadCesium(baseUrl:string):Promise<CesiumApi>{
 const base=normalize(baseUrl); window.CESIUM_BASE_URL=base;
 if(!document.getElementById('tsm-cesium-widgets-css')){const l=document.createElement('link');l.id='tsm-cesium-widgets-css';l.rel='stylesheet';l.href=`${base}Widgets/widgets.css`;document.head.appendChild(l)}
 if(!isCesium(window.Cesium)){
  const existing=document.querySelector<HTMLScriptElement>('script[data-tsm-cesium="true"]');
  if(existing) await new Promise<void>((resolve,reject)=>{existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('CesiumJS failed to load.')),{once:true})});
  else await new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=`${base}Cesium.js`;s.async=true;s.dataset.tsmCesium='true';s.addEventListener('load',()=>resolve(),{once:true});s.addEventListener('error',()=>reject(new Error(`CesiumJS failed to load from ${s.src}.`)),{once:true});document.head.appendChild(s)});
 }
 if(!isCesium(window.Cesium))throw new Error('Self-hosted CesiumJS did not expose a compatible API.');
 return window.Cesium;
}

export default function CesiumTilesLayer({tilesetUrl,cesiumBaseUrl=`${import.meta.env.BASE_URL}vendor/cesium/`,onStatusChange}:CesiumTilesLayerProps){
 const mount=useRef<HTMLDivElement>(null); const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  if(!mount.current)return; let viewer:Viewer|null=null,tileset:Tileset|null=null,cancelled=false;
  const init=async()=>{try{
   onStatusChange?.('loading');const u=new URL(tilesetUrl,window.location.href);if(!['https:','http:'].includes(u.protocol))throw new Error('Tileset URL must use HTTP or HTTPS.');
   const C=await loadCesium(cesiumBaseUrl);if(cancelled||!mount.current)return;
   viewer=new C.Viewer(mount.current,{animation:false,baseLayer:false,baseLayerPicker:false,fullscreenButton:false,geocoder:false,homeButton:false,infoBox:false,navigationHelpButton:false,sceneModePicker:false,selectionIndicator:false,timeline:false});
   tileset=await C.Cesium3DTileset.fromUrl(u.href);if(cancelled){tileset.destroy();return}viewer.scene.primitives.add(tileset);await viewer.zoomTo(tileset);onStatusChange?.('ready');
  }catch(e){if(!cancelled){setError(e instanceof Error?e.message:'CesiumJS failed to initialize.');onStatusChange?.('error')}}};
  void init(); return()=>{cancelled=true;tileset?.destroy();viewer?.destroy();viewer=null;tileset=null};
 },[cesiumBaseUrl,onStatusChange,tilesetUrl]);
 return <div ref={mount} style={{position:'relative',width:'100%',height:'100%'}} aria-label="Self-hosted CesiumJS 3D Tiles viewer">{error&&<div role="alert" style={{position:'absolute',zIndex:5,top:12,left:12,right:12,padding:16,background:'#301d24',color:'#fff',border:'1px solid #a94c5d',borderRadius:8}}>3D Tiles unavailable: {error}</div>}</div>;
}
