import type { CapabilityProvider, CapabilityRequest, CapabilityResult } from '@uacf/contracts';

export class EchoProvider implements CapabilityProvider {
  public readonly id = 'test.echo';
  public readonly version = '1.0.0';

  public async execute<TInput = unknown, TOutput = TInput>(
    request: CapabilityRequest<TInput>,
  ): Promise<CapabilityResult<TOutput>> {
    return {
      success: true,
      output: request.input as TOutput,
      provider: this.id,
      traceId: crypto.randomUUID(),
    };
  }
}
