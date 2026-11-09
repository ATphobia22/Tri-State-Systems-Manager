import { randomUUID } from 'node:crypto';
import { sha256, type EvidenceEnvelope } from '../index.ts';

/** USDA NRCS Soil Data Access: read-only point lookup using fixed SQL template. */
export class SsurgoAdapter {
 readonly sourceId='usda-soils';
 readonly endpoint='https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest';
 async lookupPoint(latitude:number,longitude:number,options:{fetcher?:typeof fetch;signal?:AbortSignal;timeoutMs?:number}={}):Promise<EvidenceEnvelope<{mukeys:readonly string[];rows:readonly unknown[];crs:'EPSG:4326';scope:'SSURGO map-unit lookup'}>> {
  if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180)
   throw new Error('SSURGO_POINT_INVALID');
  const lat=latitude.toFixed(7),lon=longitude.toFixed(7);
  // Neither SQL syntax nor arbitrary WKT is accepted from a caller.
  const sql=`SELECT TOP 100 mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(${lon} ${lat})')`;
  const body=JSON.stringify({query:sql,format:'JSON'});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),options.timeoutMs??15000);
  const onAbort=()=>controller.abort(options.signal?.reason);
  if(options.signal?.aborted)controller.abort(options.signal.reason);else options.signal?.addEventListener('abort',onAbort,{once:true});
  try{
   const response=await (options.fetcher??fetch)(this.endpoint,{method:'POST',body,headers:{'Content-Type':'application/json','Accept':'application/json'},redirect:'error',signal:controller.signal});
   if(!response.ok)throw new Error('SSURGO_HTTP_'+response.status);
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length>2_000_000)throw new Error('SSURGO_RESPONSE_TOO_LARGE');
   const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as {Table?:unknown;Error?:unknown};
   if(payload.Error||!Array.isArray(payload.Table))throw new Error('SSURGO_RESPONSE_SHAPE_INVALID');
   const rows=payload.Table;
   const mukeys=rows.flatMap(row=>Array.isArray(row)&&typeof row[0]==='string'?[row[0]]:[]);
   const result={mukeys,rows,crs:'EPSG:4326' as const,scope:'SSURGO map-unit lookup' as const};
   const traceId=randomUUID(),retrievedAt=new Date().toISOString(),inputHash=sha256({latitude,longitude,sql}),outputHash=sha256(result);
   return {result,traceId,hash:outputHash,
    citations:[{url:this.endpoint,title:'USDA NRCS Soil Data Access',retrievedAt}],
    evidence:[{sourceId:this.sourceId,authority:'USDA',retrievedAt,sha256:sha256(new TextDecoder().decode(bytes)),mediaType:'application/json'}],
    provenance:{traceId,provider:'usda-soils',providerVersion:'1',generatedAt:retrievedAt,inputHash,outputHash,status:'UNVERIFIED'},
    hashes:{input:inputHash,output:outputHash}};
  }finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',onAbort);}
 }
}
