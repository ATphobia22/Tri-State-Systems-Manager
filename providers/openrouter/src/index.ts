import { HttpTextCapabilityProvider, type HttpModelRequest, type TextModelInput, type TextModelProviderOptions } from '../../../packages/provider-runtime/src/HttpTextCapabilityProvider.ts';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export class OpenRouterCapabilityProvider extends HttpTextCapabilityProvider {
  readonly id = 'provider.openrouter';
  readonly defaultModel = 'openai/gpt-4.1-mini';
  readonly environmentKeyName = 'OPENROUTER_API_KEY';

  constructor(options: TextModelProviderOptions = {}) {
    super({ ...options, model: options.model ?? process.env.OPENROUTER_MODEL }, { model: 'openai/gpt-4.1-mini', environmentKeyName: 'OPENROUTER_API_KEY' });
  }

  protected buildRequest(input: TextModelInput, maxOutputTokens: number): HttpModelRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey ?? ''}` };
    const siteUrl = process.env.OPENROUTER_SITE_URL;
    const appName = process.env.OPENROUTER_APP_NAME;
    if (siteUrl) headers['http-referer'] = siteUrl;
    if (appName) headers['x-title'] = appName;
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers,
      body: { model: this.model, messages: [...(input.system ? [{ role: 'system', content: input.system }] : []), { role: 'user', content: input.input }], max_tokens: maxOutputTokens },
    };
  }

  protected extractText(payload: unknown): string {
    const choices = record(payload).choices;
    if (!Array.isArray(choices)) return '';
    const message = record(record(choices[0]).message);
    if (typeof message.content === 'string') return message.content;
    if (!Array.isArray(message.content)) return '';
    return message.content.flatMap((part) => {
      const item = record(part);
      return typeof item.text === 'string' ? [item.text] : [];
    }).join('');
  }
}

export { OpenRouterCapabilityProvider as StubCapabilityProvider };
export default OpenRouterCapabilityProvider;
