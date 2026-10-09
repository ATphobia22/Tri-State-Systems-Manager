export type CapabilityId =
  | `web.${string}`
  | `research.${string}`
  | `browser.${string}`
  | `maps.${string}`
  | `geo.${string}`
  | `data.${string}`
  | `document.${string}`
  | `code.${string}`
  | `workflow.${string}`
  | `api.${string}`
  | `system.${string}`
  | `quantum.${string}`
  | `website.${string}`
  | `seo.${string}`
  | `monitor.${string}`
  | `mcp.${string}`
  | `test.${string}`
  | `tsm.${string}`
  | `gates.${string}`
  | `hydrology.${string}`
  | `evidence.${string}`;
export type JsonSchema = Record<string, unknown>;
export interface PermissionSet {
  readonly allow: readonly string[];
  readonly deny?: readonly string[];
}
export interface CapabilityContext {
  readonly requestId: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly permissions: PermissionSet;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface ExecutionOptions {
  readonly timeoutMs?: number;
  readonly deterministic?: boolean;
  readonly seed?: number;
  readonly pinnedProvider?: string;
  readonly pinnedCapabilityVersion?: string;
  readonly maxProviderAttempts?: number;
  readonly requireCitations?: boolean;
  readonly requireProvenance?: boolean;
}
export interface CapabilityDefinition {
  readonly id: CapabilityId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  readonly permissions: readonly string[];
  readonly tags: readonly string[];
}
export interface CapabilityRequest<TInput = unknown> {
  readonly capability: CapabilityId;
  readonly input: TInput;
  readonly context: CapabilityContext;
  readonly options?: ExecutionOptions;
}
export type CapabilityErrorCode =
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'VALIDATION_FAILED'
  | 'POLICY_DENIED'
  | 'SECURITY_BLOCKED'
  | 'INTERNAL_ERROR';
export interface CapabilityError {
  readonly code: CapabilityErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly traceId: string;
}
export interface Citation {
  readonly id: string;
  readonly url: string;
  readonly title?: string;
  readonly retrievedAt: string;
}
export interface ProvenanceRecord {
  readonly sourceType: 'model' | 'web' | 'api' | 'database' | 'file' | 'tool' | 'workflow' | 'provider';
  readonly sourceId: string;
  readonly provider?: string;
  readonly version?: string;
  readonly timestamp: string;
  readonly inputHash?: string;
  readonly outputHash?: string;
  readonly parentTraceId?: string;
}
export interface CapabilityResult<TOutput = unknown> {
  readonly success: boolean;
  readonly output?: TOutput;
  readonly error?: CapabilityError;
  readonly provenance: readonly ProvenanceRecord[];
  readonly citations: readonly Citation[];
  readonly usage: Readonly<Record<string, number | undefined>>;
  readonly events: readonly ExecutionEvent[];
  readonly provider: ProviderExecution;
  readonly traceId: string;
}
export interface ProviderExecution {
  readonly providerId: string;
  readonly version: string;
  readonly attempt: number;
  readonly startedAt: string;
  readonly completedAt?: string;
}
export type ExecutionEvent = {
  readonly type: 'capability.started' | 'capability.completed' | 'capability.failed' | 'policy.denied';
  readonly traceId: string;
  readonly timestamp: string;
  readonly capability: CapabilityId;
  readonly reason?: string;
};
export interface ProviderHealth {
  readonly healthy: boolean;
  readonly latencyMs?: number;
  readonly errorRate?: number;
  readonly lastChecked: string;
}
export interface SupportDecision {
  readonly supported: boolean;
  readonly reason?: string;
}
export interface CapabilityProvider<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly version: string;
  readonly capabilities: readonly CapabilityDefinition[];
  health(): Promise<ProviderHealth>;
  supports(capability: CapabilityId, input: unknown): Promise<SupportDecision>;
  execute(request: CapabilityRequest<TInput>): Promise<CapabilityResult<TOutput>>;
}
export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly requireApproval?: boolean;
  readonly reason?: string;
}
export interface PolicyEngine {
  authorize(request: CapabilityRequest): Promise<AuthorizationDecision>;
  canUse(capability: CapabilityDefinition, context: CapabilityContext): Promise<boolean>;
}

export interface ProviderScore {
  readonly providerId: string;
  readonly supported: boolean;
  readonly estimatedCost: number;
  readonly estimatedLatencyMs: number;
  readonly reliability: number;
  readonly policyAllowed: boolean;
}
export type ModelCapability =
  | 'text'
  | 'structured_output'
  | 'tool_calling'
  | 'json_schema'
  | 'streaming'
  | 'embeddings'
  | 'reasoning';
export interface ModelAdapter {
  readonly provider: string;
  readonly model: string;
  capabilities(): readonly ModelCapability[];
  generate(input: unknown, options?: Readonly<Record<string, unknown>>): AsyncIterable<unknown>;
  generateStructured<T>(
    input: unknown,
    schema: JsonSchema,
    options?: Readonly<Record<string, unknown>>,
  ): Promise<T>;
  callTools(
    input: unknown,
    tools: readonly unknown[],
    options?: Readonly<Record<string, unknown>>,
  ): AsyncIterable<unknown>;
}
