export interface OpenAIAdapterOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
  readonly maxInputCharacters?: number;
  readonly fetchImpl?: typeof fetch;
}
export interface TextGenerationRequest {
  readonly input: string;
  readonly system?: string;
  readonly maxOutputTokens?: number;
}
export interface TextGenerationResponse {
  readonly provider: 'openai';
  readonly model: string;
  readonly text: string;
  readonly requestId?: string;
}

interface OpenAIResponsesPayload {
  readonly id?: unknown;
  readonly output_text?: unknown;
  readonly output?: unknown;
}
function extractOutputText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (!Array.isArray(payload.output)) throw new Error('OpenAI response did not contain text output');
  const chunks: string[] = [];
  for (const item of payload.output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const record = part as { type?: unknown; text?: unknown };
      if (record.type === 'output_text' && typeof record.text === 'string') chunks.push(record.text);
    }
  }
  if (chunks.length === 0) throw new Error('OpenAI response did not contain text output');
  return chunks.join('');
}

/** Minimal Responses API adapter. It never logs or returns credentials or raw provider errors. */
export class OpenAITextAdapter {
  readonly #apiKey: string | undefined;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #maxInputCharacters: number;
  readonly #fetch: typeof fetch;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.#apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    this.#model = options.model ?? 'gpt-4.1-mini';
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#maxInputCharacters = options.maxInputCharacters ?? 1_000_000;
    this.#fetch = options.fetchImpl ?? fetch;
    if (!Number.isInteger(this.#timeoutMs) || this.#timeoutMs < 1 || this.#timeoutMs > 300_000) {
      throw new Error('timeoutMs must be 1..300000');
    }
    if (!Number.isInteger(this.#maxInputCharacters) || this.#maxInputCharacters < 1 || this.#maxInputCharacters > 5_000_000) {
      throw new Error('maxInputCharacters must be 1..5000000');
    }
  }

  async generate(request: TextGenerationRequest, signal?: AbortSignal): Promise<TextGenerationResponse> {
    if (!this.#apiKey) throw new Error('OPENAI_API_KEY is not configured');
    if (!request.input.trim()) throw new Error('input must not be empty');
    if (request.input.length > this.#maxInputCharacters) throw new Error('input exceeds configured size limit');
    const maxOutputTokens = request.maxOutputTokens ?? 2048;
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 32_768) {
      throw new Error('maxOutputTokens must be 1..32768');
    }
    if (signal?.aborted) throw signal.reason ?? new Error('request aborted');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('provider timeout')), this.#timeoutMs);
    const abort = () => controller.abort(signal?.reason ?? new Error('request aborted'));
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.#fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.#apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.#model,
          input: [
            { role: 'system', content: request.system ?? 'Answer accurately. State uncertainty.' },
            { role: 'user', content: request.input },
          ],
          max_output_tokens: maxOutputTokens,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OpenAI request failed with HTTP ${response.status}`);
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object') throw new Error('OpenAI response was not an object');
      const payload = body as OpenAIResponsesPayload;
      const text = extractOutputText(payload);
      return {
        provider: 'openai',
        model: this.#model,
        text,
        requestId: typeof payload.id === 'string' ? payload.id : undefined,
      };
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}
