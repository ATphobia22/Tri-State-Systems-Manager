import type { JsonSchema, ModelAdapter, ModelCapability } from '../../contracts/src/index.ts';

export class LocalModelAdapter implements ModelAdapter {
  readonly provider = 'local';
  readonly model: string;
  constructor(model = 'local-reference') { this.model = model; }
  capabilities(): readonly ModelCapability[] { return ['text','structured_output','tool_calling','json_schema']; }
  async *generate(input: unknown): AsyncIterable<unknown> { yield { type: 'complete', input }; }
  async generateStructured<T>(_input: unknown, _schema: JsonSchema): Promise<T> { throw new Error('Local reference adapter does not synthesize structured output'); }
  async *callTools(input: unknown, tools: readonly unknown[]): AsyncIterable<unknown> { yield { type: 'complete', input, tools }; }
}
