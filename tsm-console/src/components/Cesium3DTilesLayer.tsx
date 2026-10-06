import { useEffect, useRef, useState } from 'react';

interface Tileset { destroy(): void }
interface Primitives { add(tileset: Tileset): Tileset }
interface Scene { primitives: Primitives }
interface Viewer { scene: Scene; destroy(): void }
interface CesiumApi { Viewer: new (container: HTMLElement, options: Record<string, unknown>) => Viewer; Cesium3DTileset: { fromUrl(url: string): Promise<Tileset> } }

declare global { interface Window { Cesium?: unknown; CESIUM_BASE_URL?: string } }

export interface Cesium3DTilesLayerProps {
 readonly tilesetUrl: string;
 readonly cesiumBaseUrl?: string;
 readonly enabled?: boolean;
 readonly onStatusChange?: (status:'loading'|'ready'|'error'|'disabled')=>void;
 readonly className?: string;
}

function api(value: unknown): value is CesiumApi {
 if(typeof value!=='object'||value===null) return false;
 const r=value as Record<string,unknown>, c=r.Cesium3DTileset;
 return typeof r.Viewer==='function'&&typeof c==='object'&&c!==null&&typeof (c as Record<string,unknown>).fromUrl==='function';
}
function base(url:string):string{return url.endsWith('/')?url:`${url}/`}
function safeUrl(url:string):string {
 const u=new URL(url,window.location.href);
 if(u.protocol!=='http:'&&u.protocol!=='https:') throw new Error('Cesium tileset URL must use HTTP or HTTPS.');
 return u.href;
}
async function loadCesium(baseUrl:string):Promise<CesiumApi>{
 const b=base(baseUrl); window.CESIUM_BASE_URL=b;
 if(!document.getElementById('tsm-cesium-widgets-css')){
  const l=document.createElement('link'); l.id='tsm-cesium-widgets-css'; l.rel='stylesheet'; l.href=`${b}Widgets/widgets.css`; document.head.appendChild(l);
 }
 if(!api(window.Cesium)){
  const existing=document.querySelector<HTMLScriptElement>('script[data-tsm-cesium="true"]');
  if(existing) await new Promise<void>((res,rej)=>{existing.addEventListener('load',()=>res(),{once:true}); existing.addEventListener('error',()=>rej(new Error('CesiumJS script failed to load.')),{once:true})});
  else await new Promise<void>((res,rej)=>{const s=document.createElement('script'); s.src=`${b}Cesium.js`; s.async=true; s.dataset.tsmCesium='true'; s.addEventListener('load',()=>res(),{once:true}); s.addEventListener('error',()=>rej(new Error(`CesiumJS failed to load from ${s.src}.`)),{once:true}); document.head.appendChild(s)});
 }
 if(!api(window.Cesium)) throw new Error('Self-hosted CesiumJS did not expose a compatible API.');
 return window.Cesium;
}

export default function Cesium3DTilesLayer({tilesetUrl,cesiumBaseUrl=`${import.meta.env.BASE_URL}vendor/cesium/`,enabled=true,onStatusChange,className}:Cesium3DTilesLayerProps){
 const mount=useRef<HTMLDivElement>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'|'disabled'>(enabled?'loading':'disabled');
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  if(!enabled){setStatus('disabled');onStatusChange?.('disabled');return}
  if(!mount.current)return;
  let viewer:Viewer|null=null, tileset:Tileset|null=null, disposed=false;
  const set=(s:'loading'|'ready'|'error'|'disabled',e:string|null=null)=>{if(disposed)return;setError(e);setStatus(s);onStatusChange?.(s)};
  const init=async()=>{try{
   set('loading'); const u=safeUrl(tilesetUrl), C=await loadCesium(cesiumBaseUrl); if(disposed||!mount.current)return;
   viewer=new C.Viewer(mount.current,{animation:false,baseLayer:false,baseLayerPicker:false,fullscreenButton:false,geocoder:false,homeButton:false,infoBox:false,navigationHelpButton:false,sceneModePicker:false,selectionIndicator:false,timeline:false});
   tileset=await C.Cesium3DTileset.fromUrl(u); if(disposed){tileset.destroy();return}
   viewer.scene.primitives.add(tileset); set('ready');
  }catch(e){set('error',e instanceof Error?e.message:'CesiumJS failed to initialize.')}};
  void init();
  return ()=>{disposed=true;tileset?.destroy();viewer?.destroy();viewer=null;tileset=null};
 },[cesiumBaseUrl,enabled,onStatusChange,tilesetUrl]);
 if(!enabled)return null;
 return <div ref={mount} className={className} style={{position:'absolute',inset:0,overflow:'hidden'}} aria-label="CesiumJS self-hosted 3D Tiles viewer">
  {status==='loading'&&<div role="status" style={{padding:12}}>Loading self-hosted CesiumJS…</div>}
  {status==='error'&&<div role="alert" style={{padding:12}}>CesiumJS unavailable: {error??'unknown error'}</div>}
 </div>;
}
