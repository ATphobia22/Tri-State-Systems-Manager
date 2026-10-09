import { randomUUID } from 'node:crypto';
import type { CapabilityRequest, CapabilityResult } from '../../contracts/src/index.ts';
import type { UniversalCapabilityFabric } from '../../core/src/UniversalCapabilityFabric.ts';
import {
  DEFAULT_AUTONOMY,
  evaluateAutonomy,
  type AutonomyLevel,
} from './AutonomyLadder.ts';

export class AgentRuntime {
  public constructor(private readonly fabric: UniversalCapabilityFabric) {}

  public execute<TInput = unknown, TOutput = unknown>(
    request: CapabilityRequest<TInput>,
    options?: { autonomy?: AutonomyLevel; humanGated?: boolean },
  ): Promise<CapabilityResult<TOutput>> {
    const requestId = request.context.requestId || randomUUID();
    const autonomy = options?.autonomy ?? DEFAULT_AUTONOMY;
    const decision = evaluateAutonomy(request.capability, autonomy, options?.humanGated === true);

    if (!decision.allowed) {
      return Promise.resolve({
        success: false,
        output: undefined as TOutput,
        provenance: [],
        citations: [],
        usage: {},
        events: [],
        provider: {
          providerId: 'agent-runtime',
          version: '0.1.0',
          attempt: 1,
          startedAt: new Date().toISOString(),
        },
        traceId: requestId,
        error: { code: 'POLICY_DENIED', message: decision.reason, retryable: false, traceId: requestId },
      } as CapabilityResult<TOutput>);
    }

    return this.fabric.execute<TOutput>({
      ...request,
      context: { ...request.context, requestId },
    });
  }

  public describeAvailableCapabilities(context: CapabilityRequest['context']) {
    return this.fabric.router.describeAvailableCapabilities(context);
  }
}
