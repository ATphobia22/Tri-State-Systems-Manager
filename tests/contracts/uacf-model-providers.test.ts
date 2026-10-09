import assert from 'node:assert/strict';
import test from 'node:test';
import { AnthropicCapabilityProvider } from '../../providers/anthropic/src/index.ts';
import { GoogleCapabilityProvider } from '../../providers/google/src/index.ts';
import { OpenRouterCapabilityProvider } from '../../providers/openrouter/src/index.ts';

const request = {
  capability: 'system.model.generate' as const,
  input: { input: 'Say hello', system: 'Be concise', maxOutputTokens: 24 },
  context: { requestId: 'provider-test-1', permissions: { allow: ['provider.invoke'] } },
};

test('Anthropic adapter sends Messages API request and parses text blocks', async () => {
  const provider = new AnthropicCapabilityProvider({
    apiKey: 'test-secret',
    model: 'test-model',
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers['x-api-key'], 'test-secret');
      assert.equal(headers['anthropic-version'], '2023-06-01');
      const body = JSON.parse(String(init?.body)) as { max_tokens: number; messages: { content: string }[] };
      assert.equal(body.max_tokens, 24);
      assert.equal(body.messages[0].content, 'Say hello');
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hello from Anthropic' }] }), { status: 200 });
    },
  });
  const result = await provider.execute(request);
  assert.equal(result.success, true);
  assert.equal(result.output?.text, 'Hello from Anthropic');
  assert.equal(result.provider.providerId, 'provider.anthropic');
});

test('Google adapter keeps API key in a header and parses candidate parts', async () => {
  const provider = new GoogleCapabilityProvider({
    apiKey: 'test-secret',
    model: 'gemini-test',
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
      assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-secret');
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello from Google' }] } }] }), { status: 200 });
    },
  });
  const result = await provider.execute(request);
  assert.equal(result.success, true);
  assert.equal(result.output?.text, 'Hello from Google');
});

test('OpenRouter adapter parses OpenAI-compatible response and reports rate limits', async () => {
  const provider = new OpenRouterCapabilityProvider({
    apiKey: 'test-secret',
    model: 'router/test-model',
    fetchImpl: async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer test-secret');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello from OpenRouter' } }] }), { status: 200 });
    },
  });
  const result = await provider.execute(request);
  assert.equal(result.success, true);
  assert.equal(result.output?.text, 'Hello from OpenRouter');

  const limited = new OpenRouterCapabilityProvider({
    apiKey: 'test-secret',
    fetchImpl: async () => new Response('{}', { status: 429 }),
  });
  const limitedResult = await limited.execute(request);
  assert.equal(limitedResult.success, false);
  assert.equal(limitedResult.error?.code, 'RATE_LIMITED');
  assert.equal(limitedResult.error?.retryable, true);
});

test('provider adapters refuse to execute without credentials and reject oversized input', async () => {
  const missing = new AnthropicCapabilityProvider({ apiKey: '', fetchImpl: async () => new Response('{}') });
  const result = await missing.execute(request);
  assert.equal(result.success, false);
  assert.equal(result.error?.code, 'PROVIDER_UNAVAILABLE');

  const bounded = new GoogleCapabilityProvider({ apiKey: 'test-secret', fetchImpl: async () => new Response('{}') });
  const invalid = await bounded.execute({ ...request, input: { input: 'x'.repeat(1_000_001) } });
  assert.equal(invalid.success, false);
  assert.equal(invalid.error?.code, 'INVALID_INPUT');
});
