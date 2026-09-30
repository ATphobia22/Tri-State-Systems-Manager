import type { CapabilityDefinition, CapabilityId, CapabilityProvider, CapabilityRequest, CapabilityResult, ProviderHealth, SupportDecision } from '../../contracts/src/index.ts';

type JsonRpcResponse = { id?: string|number; result?: Record<string, unknown>; error?: { code: number; message: string; data?: unknown } };

export interface McpClientOptions { endpoint: string; headers?: Record<string,string>; timeoutMs?: number; }

export class McpCapabilityProvider implements CapabilityProvider {
  readonly id: string;
  readonly version = 'mcp-streamable-http-1';
  private definitions: CapabilityDefinition[] = [];
  private lastHealth: ProviderHealth = { healthy: false, lastChecked: new Date(0).toISOString() };

  constructor(private readonly options: McpClientOptions, id = new URL(options.endpoint).hostname) { this.id = `mcp:${id}`; }

  get capabilities(): readonly CapabilityDefinition[] { return this.definitions; }

  async discover(): Promise<readonly CapabilityDefinition[]> {
    const init = await this.rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'tsm-uacf', version: '0.1.0' } });
    const sessionId = typeof init.sessionId === 'string' ? init.sessionId : undefined;
    const listed = await this.rpc('tools/list', {}, sessionId);
    const tools = Array.isArray((listed.result as Record<string,unknown>|undefined)?.tools) ? ((listed.result as Record<string,unknown>).tools as Record<string,unknown>[]) : [];
    this.definitions = tools.map((tool) => ({
      id: `mcp.${this.id.replace(/[^a-zA-Z0-9_-]/g,'_')}.${String(tool.name)}` as CapabilityId,
      name: String(tool.name),
      description: String(tool.description ?? 'MCP tool'),
      version: 'mcp',
      inputSchema: (tool.inputSchema as Record<string,unknown>) ?? { type: 'object' },
      outputSchema: (tool.outputSchema as Record<string,unknown>) ?? { type: 'object' },
      permissions: [`mcp:${this.id}`],
      tags: ['mcp', 'remote'],
    }));
    this.lastHealth = { healthy: true, latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString() };
    return this.definitions;
  }

  async health(): Promise<ProviderHealth> {
    const started = Date.now();
    try { await this.rpc('ping', {}); this.lastHealth = { healthy:true, latencyMs:Date.now()-started, errorRate:0, lastChecked:new Date().toISOString() }; }
    catch { this.lastHealth = { healthy:false, latencyMs:Date.now()-started, errorRate:1, lastChecked:new Date().toISOString() }; }
    return this.lastHealth;
  }

  async supports(capability: CapabilityId): Promise<SupportDecision> {
    if (!this.definitions.length) await this.discover();
    return { supported: this.definitions.some((d) => d.id === capability) };
  }

  async execute(request: CapabilityRequest): Promise<CapabilityResult> {
    const definition = this.definitions.find((d) => d.id === request.capability);
    if (!definition) throw new Error(`MCP capability not found: ${request.capability}`);
    const started = Date.now();
    try {
      const toolName = definition.name;
      const result = await this.rpc('tools/call', { name: toolName, arguments: request.input });
      return {
        success: !result.error,
        output: result.error ? undefined : (result.result as Record<string,unknown>),
        error: result.error ? { code:'PROVIDER_UNAVAILABLE', message:result.error.message, retryable:true, traceId:request.context.requestId } : undefined,
        provenance: [], citations: [], usage: { durationMs: Date.now()-started },
        events: [{ type:'capability.completed', traceId:request.context.requestId, timestamp:new Date().toISOString(), capability:request.capability }],
        provider:{ providerId:this.id, version:this.version, attempt:1, startedAt:new Date(started).toISOString(), completedAt:new Date().toISOString() },
        traceId:request.context.requestId,
      };
    } catch (error) {
      throw error;
    }
  }

  private async rpc(method: string, params: Record<string,unknown>, sessionId?: string): Promise<JsonRpcResponse & { sessionId?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15000);
    try {
      const response = await fetch(this.options.endpoint, { method:'POST', headers:{ accept:'application/json, text/event-stream', 'content-type':'application/json', ...this.options.headers, ...(sessionId ? {'Mcp-Session-Id':sessionId}: {}) }, body:JSON.stringify({ jsonrpc:'2.0', id:Date.now(), method, params }), signal:controller.signal });
      if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
      const text = await response.text();
      const data = text.includes('data:') ? text.split(/\n\n/).map((x)=>x.match(/^data:\s*(.+)$/m)?.[1]).filter(Boolean).map((x)=>JSON.parse(x!)).at(-1) : JSON.parse(text);
      if (data?.error) throw new Error(String(data.error.message ?? 'MCP JSON-RPC error'));
      return { ...(data as JsonRpcResponse), sessionId: response.headers.get('Mcp-Session-Id') ?? sessionId };
    } finally { clearTimeout(timer); }
  }
}
