import { randomUUID } from 'node:crypto';
import type { CapabilityRequest, CapabilityResult } from '../../contracts/src/index.ts';
import type { UniversalCapabilityFabric } from '../../core/src/UniversalCapabilityFabric.ts';

export class AgentRuntime {
  public constructor(private readonly fabric: UniversalCapabilityFabric) {}

  public execute<TInput = unknown, TOutput = unknown>(
    request: CapabilityRequest<TInput>,
  ): Promise<CapabilityResult<TOutput>> {
    const requestId = request.context.requestId || randomUUID();
    return this.fabric.execute<TOutput>({
      ...request,
      context: { ...request.context, requestId },
    });
  }

  public describeAvailableCapabilities(context: CapabilityRequest['context']) {
    return this.fabric.router.describeAvailableCapabilities(context);
  }
}
