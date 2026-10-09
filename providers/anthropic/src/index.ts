import { HttpTextCapabilityProvider, type HttpModelRequest, type TextModelInput, type TextModelProviderOptions } from '../../../packages/provider-runtime/src/HttpTextCapabilityProvider.ts';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export class AnthropicCapabilityProvider extends HttpTextCapabilityProvider {
  readonly id = 'provider.anthropic';
  readonly defaultModel = 'claude-3-5-haiku-latest';
  readonly environmentKeyName = 'ANTHROPIC_API_KEY';

  constructor(options: TextModelProviderOptions = {}) {
    super({ ...options, model: options.model ?? process.env.ANTHROPIC_MODEL }, { model: 'claude-3-5-haiku-latest', environmentKeyName: 'ANTHROPIC_API_KEY' });
  }

  protected buildRequest(input: TextModelInput, maxOutputTokens: number): HttpModelRequest {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey ?? '', 'anthropic-version': '2023-06-01' },
      body: { model: this.model, max_tokens: maxOutputTokens, ...(input.system ? { system: input.system } : {}), messages: [{ role: 'user', content: input.input }] },
    };
  }

  protected extractText(payload: unknown): string {
    const content = record(payload).content;
    if (!Array.isArray(content)) return '';
    return content.flatMap((part) => {
      const item = record(part);
      return item.type === 'text' && typeof item.text === 'string' ? [item.text] : [];
    }).join('');
  }
}

export { AnthropicCapabilityProvider as StubCapabilityProvider };
export default AnthropicCapabilityProvider;
