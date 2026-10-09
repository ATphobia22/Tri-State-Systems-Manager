import type { CapabilityRequest, CapabilityResult } from '../../contracts/src/index.ts';
import type { CapabilityRouter } from '../../router/src/CapabilityRouter.ts';
import {
  DEFAULT_AUTONOMY,
  evaluateAutonomy,
  type AutonomyLevel,
} from '../../agent-runtime/src/AutonomyLadder.ts';

/**
 * Universal agent entry — always subject to ADR-006 autonomy ladder.
 * Default S1; S2 requires humanGated; S3 denied.
 */
export class UniversalAgent {
  public constructor(private readonly router: CapabilityRouter) {}

  public execute<TInput = unknown, TOutput = unknown>(
    request: CapabilityRequest<TInput>,
    options?: { autonomy?: AutonomyLevel; humanGated?: boolean },
  ): Promise<CapabilityResult<TOutput>> {
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
          providerId: 'universal-agent',
          version: '0.1.0',
          attempt: 1,
          startedAt: new Date().toISOString(),
        },
        traceId: request.context.requestId,
        error: { code: 'AUTONOMY_DENIED', message: decision.reason },
      } as CapabilityResult<TOutput>);
    }
    return this.router.execute<TOutput>(request);
  }
}
