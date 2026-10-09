export {
  HttpTextCapabilityProvider,
  type HttpModelRequest,
  type TextModelInput,
  type TextModelOutput,
  type TextModelProviderOptions,
} from './HttpTextCapabilityProvider.ts';

import type {
  CapabilityProvider,
  CapabilityRequest,
  CapabilityResult,
} from '../../contracts/src/index.ts';

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors: readonly string[];
}

export async function executeWithRetry<T>(
  provider: CapabilityProvider,
  request: CapabilityRequest,
  policy: RetryPolicy,
): Promise<CapabilityResult<T>> {
  let last: CapabilityResult<T> | undefined;
  for (let attempt = 1; attempt <= Math.max(1, policy.maxAttempts); attempt++) {
    const result = (await provider.execute(request)) as CapabilityResult<T>;
    last = result;
    if (result.success || !result.error?.retryable || !policy.retryableErrors.includes(result.error.code)) {
      return result;
    }
    if (attempt < policy.maxAttempts) {
      await new Promise((r) =>
        setTimeout(r, Math.min(policy.maxDelayMs, policy.initialDelayMs * 2 ** (attempt - 1))),
      );
    }
  }
  if (!last) throw new Error('Provider failed without a result');
  return last;
}
