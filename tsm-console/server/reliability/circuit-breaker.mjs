export class CircuitOpenError extends Error {
  constructor(sourceId, retryAt) {
    super(`circuit open for ${sourceId} until ${new Date(retryAt).toISOString()}`);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
    this.sourceId = sourceId;
    this.retryAt = retryAt;
  }
}

export function createCircuitBreaker({ failureThreshold = 3, cooldownMs = 30_000, now = () => Date.now() } = {}) {
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1) throw new RangeError('failureThreshold must be >= 1');
  const state = new Map();
  function get(sourceId) {
    if (!sourceId) throw new TypeError('sourceId required');
    return state.get(sourceId) || { sourceId, state: 'closed', failures: 0, openedAt: null, retryAt: null };
  }
  return Object.freeze({
    beforeRequest(sourceId) {
      const current = get(sourceId);
      if (current.state === 'open') {
        if (now() < current.retryAt) throw new CircuitOpenError(sourceId, current.retryAt);
        const half = { ...current, state: 'half-open' };
        state.set(sourceId, half);
        return half;
      }
      return current;
    },
    recordSuccess(sourceId) {
      const next = { sourceId, state: 'closed', failures: 0, openedAt: null, retryAt: null, lastSuccessAt: now() };
      state.set(sourceId, next);
      return next;
    },
    recordFailure(sourceId) {
      const current = get(sourceId);
      const failures = current.failures + 1;
      const opened = failures >= failureThreshold;
      const next = { ...current, state: opened ? 'open' : 'closed', failures, openedAt: opened ? now() : current.openedAt, retryAt: opened ? now() + cooldownMs : current.retryAt, lastFailureAt: now() };
      state.set(sourceId, next);
      return next;
    },
    getState(sourceId) { return { ...get(sourceId) }; },
    list() { return [...state.values()].map((entry) => ({ ...entry })); },
    clear() { state.clear(); },
  });
}
