import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../contracts/src/index.ts';

const routes: Record<string,{method:'GET'|'POST';path:string}> = {
  'tsm.engineering.compensatory-storage':{method:'POST',path:'/api/v1/engineering/compensatory-storage'},
  'tsm.engineering.ras-results':{method:'POST',path:'/api/engineering/ras-results'},
  'tsm.hydraulic.transfer':{method:'POST',path:'/api/hydraulic/transfer'},
  'tsm.autonomy.evaluate':{method:'POST',path:'/api/autonomy/evaluate'},
  'tsm.hydrologic.calibration':{method:'GET',path:'/api/hydrologic/calibration'},
  'tsm.geospatial.posey.site':{method:'GET',path:'/api/geospatial/posey/site'},
};
export class TsmEngineeringProvider implements CapabilityProvider {
  readonly id='tsm-engineering'; readonly version='1.0.0';
  readonly capabilities: CapabilityDefinition[] = Object.keys(routes).map((id)=>({id:id as CapabilityId,name:id,description:`TSM engineering capability backed by the native TSM API route ${routes[id]!.path}`,version:this.version,inputSchema:{type:'object'},outputSchema:{type:'object'},permissions:[`tsm:${id.split('.').slice(1,2)[0] ?? 'engineering'}`],tags:['tsm','engineering','digital-twin']}));
  constructor(private readonly baseUrl=process.env.TSM_API_BASE_URL ?? 'http://127.0.0.1:8787', private readonly bearerToken=process.env.TSM_API_BEARER_TOKEN) {}
  async health(): Promise<ProviderHealth> { const started=Date.now(); try{const r=await fetch(`${this.baseUrl}/ready`,{headers:this.authHeaders()}); return {healthy:r.ok,latencyMs:Date.now()-started,errorRate:r.ok?0:1,lastChecked:new Date().toISOString()};}catch{return{healthy:false,latencyMs:Date.now()-started,errorRate:1,lastChecked:new Date().toISOString()}}}
  async supports(capability: CapabilityId): Promise<SupportDecision> { return {supported:Boolean(routes[capability])}; }
  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const route=routes[request.capability]; if(!route) throw new Error(`Unsupported TSM capability: ${request.capability}`);
    const started=Date.now(); const headers={'content-type':'application/json',...this.authHeaders()}; const url=new URL(route.path,this.baseUrl);
    if(route.method==='GET') for(const [k,v] of Object.entries((request.input as Record<string,unknown>) ?? {})) if(v!==undefined&&v!==null) url.searchParams.set(k,String(v));
    const response=await fetch(url,{method:route.method,headers,body:route.method==='POST'?JSON.stringify(request.input ?? {}):undefined});
    const text=await response.text(); let output:unknown; try{output=JSON.parse(text)}catch{output=text};
    const ok=response.ok;
    return {success:ok,output:ok?output:undefined,error:ok?undefined:{code:response.status===403?'FORBIDDEN':response.status===401?'UNAUTHORIZED':response.status===429?'RATE_LIMITED':'PROVIDER_UNAVAILABLE',message:`TSM route ${route.path} returned HTTP ${response.status}`,retryable:response.status===429||response.status>=500,traceId:request.context.requestId},provenance:[],citations:[],usage:{durationMs:Date.now()-started,status:response.status},events:[{type:ok?'capability.completed':'capability.failed',traceId:request.context.requestId,timestamp:new Date().toISOString(),capability:request.capability}],provider:{providerId:this.id,version:this.version,attempt:1,startedAt:new Date(started).toISOString(),completedAt:new Date().toISOString()},traceId:request.context.requestId};
  }
  private authHeaders():Record<string,string>{return this.bearerToken?{authorization:`Bearer ${this.bearerToken}`}:{};}
}
