import type {
  CapabilityDefinition,
  CapabilityProvider,
  CapabilityRequest,
  CapabilityResult,
  ProviderHealth,
  SupportDecision,
} from '../../contracts/src/index.ts';

export interface TextModelProviderOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

export interface TextModelInput {
  readonly input: string;
  readonly system?: string;
  readonly maxOutputTokens?: number;
}

export interface TextModelOutput {
  readonly text: string;
  readonly model: string;
}

export interface HttpModelRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, unknown>>;
}

/** Shared fail-closed lifecycle for HTTP-backed text providers. */
export abstract class HttpTextCapabilityProvider
  implements CapabilityProvider<TextModelInput, TextModelOutput>
{
  abstract readonly id: string;
  abstract readonly defaultModel: string;
  abstract readonly environmentKeyName: string;
  readonly version = '0.1.0';
  readonly capabilities: readonly CapabilityDefinition[] = [
    {
      id: 'system.model.generate',
      name: 'Text generation',
      description: 'Generate text from a validated text prompt.',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        required: ['input'],
        properties: {
          input: { type: 'string', minLength: 1, maxLength: 1_000_000 },
          system: { type: 'string', maxLength: 100_000 },
          maxOutputTokens: { type: 'integer', minimum: 1, maximum: 32_768 },
        },
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        required: ['text', 'model'],
        properties: { text: { type: 'string' }, model: { type: 'string' } },
        additionalProperties: false,
      },
      permissions: ['provider.invoke'],
      tags: ['model', 'text'],
    },
  ];

  readonly model: string;
  readonly #apiKey: string | undefined;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  protected constructor(
    options: TextModelProviderOptions = {},
    defaults: { readonly model: string; readonly environmentKeyName: string },
  ) {
    this.model = options.model ?? defaults.model;
    this.#apiKey = options.apiKey ?? process.env[defaults.environmentKeyName];
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#fetch = options.fetchImpl ?? fetch;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1 || this.#timeoutMs > 300_000) {
      throw new Error('timeoutMs must be an integer in 1..300000');
    }
    if (!this.model.trim() || this.model.length > 200) {
      throw new Error('model must be a non-empty string of at most 200 characters');
    }
  }

  protected get apiKey(): string | undefined {
    return this.#apiKey;
  }

  protected abstract buildRequest(input: TextModelInput, maxOutputTokens: number): HttpModelRequest;
  protected abstract extractText(payload: unknown): string;

  async health(): Promise<ProviderHealth> {
    const configured = Boolean(this.#apiKey);
    return {
      healthy: configured,
      latencyMs: 0,
      errorRate: configured ? 0 : 1,
      lastChecked: new Date().toISOString(),
    };
  }

  async supports(capability: string, input: unknown): Promise<SupportDecision> {
    if (capability !== 'system.model.generate') return { supported: false, reason: 'capability not supported' };
    if (!input || typeof input !== 'object' || typeof (input as { input?: unknown }).input !== 'string') {
      return { supported: false, reason: 'input must contain a string field named input' };
    }
    return { supported: true };
  }

  async execute(request: CapabilityRequest<TextModelInput>): Promise<CapabilityResult<TextModelOutput>> {
    const startedAt = new Date().toISOString();
    const traceId = request.context.requestId;
    const base = {
      provenance: [],
      citations: [],
      usage: {},
      traceId,
      provider: { providerId: this.id, version: this.version, attempt: 1, startedAt },
    } as const;

    const fail = (
      code: 'INVALID_INPUT' | 'PROVIDER_UNAVAILABLE' | 'RATE_LIMITED' | 'TIMEOUT',
      message: string,
      retryable: boolean,
    ): CapabilityResult<TextModelOutput> => ({
      ...base,
      success: false,
      error: { code, message, retryable, traceId },
      events: [{ type: 'capability.failed', traceId, timestamp: new Date().toISOString(), capability: request.capability, reason: code }],
      provider: { ...base.provider, completedAt: new Date().toISOString() },
    });

    if (request.capability !== 'system.model.generate') {
      return fail('INVALID_INPUT', 'Unsupported capability', false);
    }
    if (!request.input || typeof request.input.input !== 'string' || !request.input.input.trim()) {
      return fail('INVALID_INPUT', 'input must be a non-empty string', false);
    }
    if (request.input.input.length > 1_000_000 || (request.input.system?.length ?? 0) > 100_000) {
      return fail('INVALID_INPUT', 'Input exceeds the configured size limit', false);
    }
    const maxOutputTokens = request.input.maxOutputTokens ?? 2048;
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 32_768) {
      return fail('INVALID_INPUT', 'maxOutputTokens must be an integer in 1..32768', false);
    }
    if (!this.#apiKey) {
      return fail('PROVIDER_UNAVAILABLE', `${this.id} credentials are not configured`, false);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const outgoing = this.buildRequest(request.input, maxOutputTokens);
      const response = await this.#fetch(outgoing.url, {
        method: 'POST',
        headers: outgoing.headers,
        body: JSON.stringify(outgoing.body),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) return fail('RATE_LIMITED', `${this.id} rate limit reached`, true);
        if (response.status >= 500) return fail('PROVIDER_UNAVAILABLE', `${this.id} returned HTTP ${response.status}`, true);
        return fail('PROVIDER_UNAVAILABLE', `${this.id} rejected the request with HTTP ${response.status}`, false);
      }
      const payload: unknown = await response.json();
      const text = this.extractText(payload);
      if (!text.trim()) return fail('PROVIDER_UNAVAILABLE', `${this.id} returned an empty text result`, true);
      const completedAt = new Date().toISOString();
      return {
        ...base,
        success: true,
        output: { text, model: this.model },
        provenance: [{
          sourceType: 'model',
          sourceId: this.model,
          provider: this.id,
          version: this.version,
          timestamp: completedAt,
          parentTraceId: traceId,
        }],
        events: [
          { type: 'capability.started', traceId, timestamp: startedAt, capability: request.capability },
          { type: 'capability.completed', traceId, timestamp: completedAt, capability: request.capability },
        ],
        provider: { ...base.provider, completedAt },
      };
    } catch (error) {
      if (controller.signal.aborted) return fail('TIMEOUT', `${this.id} request timed out`, true);
      return fail('PROVIDER_UNAVAILABLE', `${this.id} request failed`, true);
    } finally {
      clearTimeout(timer);
    }
  }
}
