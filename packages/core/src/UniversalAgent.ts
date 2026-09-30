import type { CapabilityResult } from '@uacf/contracts';
import type { CapabilityRouter } from '@uacf/router';

export class UniversalAgent {
  public constructor(private readonly router: CapabilityRouter) {}

  public execute<TInput = unknown, TOutput = unknown>(
    capability: string,
    input: TInput,
  ): Promise<CapabilityResult<TOutput>> {
    return this.router.execute<TInput, TOutput>({ capability, input });
  }
}
