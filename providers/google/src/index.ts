import { HttpTextCapabilityProvider, type HttpModelRequest, type TextModelInput, type TextModelProviderOptions } from '../../../packages/provider-runtime/src/HttpTextCapabilityProvider.ts';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export class GoogleCapabilityProvider extends HttpTextCapabilityProvider {
  readonly id = 'provider.google';
  readonly defaultModel = 'gemini-2.5-flash';
  readonly environmentKeyName = 'GOOGLE_API_KEY';

  constructor(options: TextModelProviderOptions = {}) {
    super({ ...options, apiKey: options.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY, model: options.model ?? process.env.GOOGLE_MODEL }, { model: 'gemini-2.5-flash', environmentKeyName: 'GOOGLE_API_KEY' });
  }

  protected buildRequest(input: TextModelInput, maxOutputTokens: number): HttpModelRequest {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey ?? '' },
      body: { contents: [{ role: 'user', parts: [{ text: input.input }] }], ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}), generationConfig: { maxOutputTokens } },
    };
  }

  protected extractText(payload: unknown): string {
    const candidates = record(payload).candidates;
    if (!Array.isArray(candidates)) return '';
    return candidates.flatMap((candidate) => {
      const parts = record(record(candidate).content).parts;
      if (!Array.isArray(parts)) return [];
      return parts.flatMap((part) => {
        const item = record(part);
        return typeof item.text === 'string' ? [item.text] : [];
      });
    }).join('');
  }
}

export { GoogleCapabilityProvider as StubCapabilityProvider };
export default GoogleCapabilityProvider;
