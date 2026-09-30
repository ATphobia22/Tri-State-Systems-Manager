import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../contracts/src/index.ts';

type OpenApiOperation = { path:string; method:string; operation:Record<string,unknown>; baseUrl:string };
export class OpenApiCapabilityProvider implements CapabilityProvider {
  readonly id: string; readonly version = 'openapi-3.1';
  readonly capabilities: CapabilityDefinition[];
  constructor(private readonly spec: Record<string,unknown>, id = 'openapi') {
    this.id = `openapi:${id}`;
    const servers = Array.isArray(spec.servers) ? spec.servers : [];
    const baseUrl = typeof (servers[0] as Record<string,unknown>|undefined)?.url === 'string' ? String((servers[0] as Record<string,unknown>).url) : '';
    this.capabilities = Object.entries((spec.paths as Record<string,unknown>) ?? {}).flatMap(([path,item]) => Object.entries((item as Record<string,unknown>) ?? {}).filter(([method])=>['get','post','put','patch','delete'].includes(method.toLowerCase())).map(([method,operation])=> {
      const op = operation as Record<string,unknown>; const name = String(op.operationId ?? `${method}_${path}`).replace(/[^a-zA-Z0-9_.-]/g,'_');
      return { id:`api.${name}` as CapabilityId, name, description:String(op.summary ?? op.description ?? `${method.toUpperCase()} ${path}`), version:String(spec.openapi ?? '3.1'), inputSchema:{type:'object',properties:{path:{type:'object'},query:{type:'object'},headers:{type:'object'},body:{}}}, outputSchema:{type:'object'}, permissions:[`api:${this.id}`], tags:['openapi',method.toLowerCase()] };
    }));
    this.operations = Object.entries((spec.paths as Record<string,unknown>) ?? {}).flatMap(([path,item]) => Object.entries((item as Record<string,unknown>) ?? {}).filter(([method])=>['get','post','put','patch','delete'].includes(method.toLowerCase())).map(([method,operation])=>({path,method:method.toUpperCase(),operation:operation as Record<string,unknown>,baseUrl})));
  }
  private readonly operations: OpenApiOperation[];
  async health(): Promise<ProviderHealth> { const started=Date.now(); return { healthy:this.operations.length>0, latencyMs:Date.now()-started, errorRate:0, lastChecked:new Date().toISOString() }; }
  async supports(capability: CapabilityId): Promise<SupportDecision> { return { supported:this.capabilities.some((d)=>d.id===capability) }; }
  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const definition=this.capabilities.find((d)=>d.id===request.capability); if(!definition) throw new Error('OpenAPI capability not found');
    const opIndex=this.capabilities.findIndex((d)=>d.id===request.capability); const op=this.operations[opIndex]!; const input=(request.input as Record<string,unknown>) ?? {};
    const pathValues=(input.path as Record<string,unknown>) ?? {}; let url=op.baseUrl+op.path.replace(/\{([^}]+)\}/g,(_,k)=>encodeURIComponent(String(pathValues[k] ?? '')));
    const query=(input.query as Record<string,unknown>) ?? {}; const qs=new URLSearchParams(Object.entries(query).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)])); if([...qs].length) url += `?${qs}`;
    const headers={ 'content-type':'application/json', ...((input.headers as Record<string,string>) ?? {}) };
    const response=await fetch(url,{method:op.method,headers,body:['GET','DELETE'].includes(op.method)?undefined:JSON.stringify(input.body ?? {})});
    const text=await response.text(); let output:unknown; try{output=JSON.parse(text)}catch{output=text}
    return { success:response.ok, output:response.ok?output:undefined, error:response.ok?undefined:{code:response.status===429?'RATE_LIMITED':'PROVIDER_UNAVAILABLE',message:`OpenAPI HTTP ${response.status}`,retryable:response.status===429||response.status>=500,traceId:request.context.requestId}, provenance:[], citations:[], usage:{status:response.status}, events:[{type:response.ok?'capability.completed':'capability.failed',traceId:request.context.requestId,timestamp:new Date().toISOString(),capability:request.capability}], provider:{providerId:this.id,version:this.version,attempt:1,startedAt:new Date().toISOString()}, traceId:request.context.requestId };
  }
}
