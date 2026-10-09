import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenAITextAdapter } from '../../providers/openai/src/index.ts';

test('OpenAI adapter fails closed without credentials', async () => {
  const adapter = new OpenAITextAdapter({ apiKey: '', fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => adapter.generate({ input: 'hello' }), /OPENAI_API_KEY is not configured/);
});

test('OpenAI adapter parses REST Responses output blocks', async () => {
  const adapter = new OpenAITextAdapter({
    apiKey: 'test-key',
    fetchImpl: async (_input, init) => {
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer test-key');
      return new Response(JSON.stringify({
        id: 'resp_test',
        output: [{ type: 'message', content: [
          { type: 'output_text', text: 'grounded ' },
          { type: 'output_text', text: 'answer' },
        ] }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  assert.deepEqual(await adapter.generate({ input: 'question', maxOutputTokens: 50 }), {
    provider: 'openai', model: 'gpt-4.1-mini', text: 'grounded answer', requestId: 'resp_test',
  });
});

test('OpenAI adapter bounds request sizes and token limits', async () => {
  const adapter = new OpenAITextAdapter({ apiKey: 'test-key', maxInputCharacters: 3, fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => adapter.generate({ input: 'four' }), /size limit/);
  await assert.rejects(() => adapter.generate({ input: 'ok', maxOutputTokens: 0 }), /maxOutputTokens/);
});

test('OpenAI adapter propagates caller cancellation', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled by test'));
  const adapter = new OpenAITextAdapter({ apiKey: 'test-key', fetchImpl: async () => new Response('{}') });
  await assert.rejects(() => adapter.generate({ input: 'hello' }, controller.signal), /cancelled by test/);
});
