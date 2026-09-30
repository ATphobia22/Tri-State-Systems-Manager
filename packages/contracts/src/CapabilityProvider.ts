import type { CapabilityRequest } from './CapabilityRequest.js';
import type { CapabilityResult } from './CapabilityResult.js';

export interface CapabilityProvider {
  readonly id: string;
  readonly version: string;
  execute<TInput = unknown, TOutput = unknown>(
    request: CapabilityRequest<TInput>,
  ): Promise<CapabilityResult<TOutput>>;
}
