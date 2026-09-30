import type { CapabilityRequest, CapabilityResult } from '../../contracts/src/index.ts';
import type { CapabilityRouter } from '../../router/src/CapabilityRouter.ts';

export class UniversalAgent {
  public constructor(private readonly router: CapabilityRouter) {}

  public execute<TInput = unknown, TOutput = unknown>(
    request: CapabilityRequest<TInput>,
  ): Promise<CapabilityResult<TOutput>> {
    return this.router.execute<TOutput>(request);
  }
}
