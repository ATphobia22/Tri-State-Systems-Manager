/**
 * Tile resource lifecycle — deterministic provider-transition tests.
 *
 * Covers NOT-COMPLETE registry item 3 acceptance: timeout, cancellation,
 * partial coverage, stale cache (expired vs acquisition time), provider
 * failure (5xx / empty body), and recovery (retry then success) — without
 * fabricating data and without a live provider.
 *
 * Determinism: no network, no real timers. A scripted fake provider and an
 * injected manual clock drive the REAL TileResourceLifecycle. Resilient
 * posture throughout: a failed provider surfaces a LABELED degraded state
 * (status 'failed' + lastError); it never throws a gate and never
 * synthesizes geometry (assertNotSynthetic guards the ready path).
 *
 * Transition-reachability map (public API of TileResourceLifecycle):
 *   REACHABLE via markQueued/markFetching/markReady/markFailed/markReleased/
 *   markStale from ANY prior status — the setters are total by design.
 *   UNREACHABLE without a live provider:
 *     (a) automatic time-driven staleness — the lifecycle owns no clock;
 *         the caller must evaluate acquisition time (injected clock) and
 *         call markStale explicitly;
 *     (b) provider-initiated fetching->ready/failed completions — the
 *         lifecycle never fetches; the bridge/fetch layer drives those
 *         transitions by calling back into markReady/markFailed.
 */
import { describe, expect, it } from 'vitest';
import {
  TileResourceLifecycle,
  type TileResourceRecord,
  type TileResourceStatus,
} from '../src/lib/tile-resource-lifecycle';

/* ------------------------------------------------------------------ */
/* Deterministic fakes: manual clock + scripted provider               */
/* ------------------------------------------------------------------ */

function makeClock(startMs = 1_000_000) {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

type ProviderOutcome =
  | { kind: 'ok'; bytes: number; latencyMs: number }
  | { kind: 'hang' }
  | { kind: 'http'; status: number }
  | { kind: 'empty' }
  | { kind: 'abort' };

/** Scripted fake provider: per tile id, a queue of outcomes. No I/O. */
class FakeTileProvider {
  private readonly scripts = new Map<string, ProviderOutcome[]>();
  script(id: string, outcomes: ProviderOutcome[]): void {
    this.scripts.set(id, [...outcomes]);
  }
  next(id: string): ProviderOutcome {
    const q = this.scripts.get(id);
    if (!q || q.length === 0) throw new Error(`no scripted outcome for ${id}`);
    return q.shift()!;
  }
}

interface FetchResult {
  ok: boolean;
  /** Labeled degraded state — resilient, never a thrown gate. */
  degraded?: 'timeout' | 'cancelled' | 'provider-error' | 'empty-body';
  detail?: string;
}

/**
 * Deterministic fetch coordinator: drives lifecycle transitions around a
 * scripted provider outcome. Timeout is decided by the injected clock, not
 * a real timer.
 */
async function driveFetch(
  lifecycle: TileResourceLifecycle,
  provider: FakeTileProvider,
  id: string,
  opts: {
    timeoutMs: number;
    clock: ReturnType<typeof makeClock>;
    signal?: AbortSignal;
  },
): Promise<FetchResult> {
  const { timeoutMs, clock, signal } = opts;
  lifecycle.markQueued(id, clock.now());
  lifecycle.markFetching(id, clock.now());

  const outcome = provider.next(id);
  switch (outcome.kind) {
    case 'ok': {
      clock.advance(outcome.latencyMs);
      if (signal?.aborted) {
        lifecycle.markReleased(id, clock.now());
        return { ok: false, degraded: 'cancelled', detail: 'aborted after bytes arrived' };
      }
      lifecycle.markReady(id, outcome.bytes, clock.now());
      return { ok: true };
    }
    case 'hang': {
      // Provider never responds: the coordinator's deadline (injected clock)
      // fires. Labeled failure, not a gate.
      clock.advance(timeoutMs + 1);
      lifecycle.markFailed(id, `timeout after ${timeoutMs}ms`, clock.now());
      return { ok: false, degraded: 'timeout', detail: `timeout after ${timeoutMs}ms` };
    }
    case 'http': {
      lifecycle.markFailed(id, `provider ${outcome.status}`, clock.now());
      return { ok: false, degraded: 'provider-error', detail: `provider ${outcome.status}` };
    }
    case 'empty': {
      lifecycle.markFailed(id, 'empty body', clock.now());
      return { ok: false, degraded: 'empty-body', detail: 'empty body' };
    }
    case 'abort': {
      // Mid-stream cancellation: release the slot, keep no error.
      lifecycle.markReleased(id, clock.now());
      return { ok: false, degraded: 'cancelled', detail: 'cancelled mid-stream' };
    }
  }
}

function statusOf(lifecycle: TileResourceLifecycle, id: string): TileResourceStatus | undefined {
  return lifecycle.get(id)?.status;
}

const ALL_STATUSES: TileResourceStatus[] = [
  'idle',
  'queued',
  'fetching',
  'ready',
  'stale',
  'failed',
  'released',
];

/* ------------------------------------------------------------------ */
/* 1. Request timeout                                                  */
/* ------------------------------------------------------------------ */

describe('request timeout', () => {
  it('labels a hung provider as failed-timeout (resilient, no thrown gate)', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/timeout', [{ kind: 'hang' }]);

    let result: FetchResult | undefined;
    await expect(
      (async () => {
        result = await driveFetch(lifecycle, provider, 'tile/timeout', {
          timeoutMs: 5000,
          clock,
        });
      })(),
    ).resolves.toBeUndefined();

    expect(result).toMatchObject({ ok: false, degraded: 'timeout' });
    const rec = lifecycle.get('tile/timeout')!;
    expect(rec.status).toBe('failed');
    expect(rec.lastError).toContain('timeout');
    // A timed-out tile is a retry candidate, not a dead end.
    expect(lifecycle.plan(['tile/timeout'], clock.now()).toFetch).toContain('tile/timeout');
  });

  it('does not invent geometry for a timed-out tile', () => {
    const lifecycle = new TileResourceLifecycle();
    lifecycle.markFailed('tile/timeout', 'timeout after 5000ms');
    expect(() => lifecycle.assertNotSynthetic('tile/timeout')).toThrow(/not ready/);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Cancellation mid-stream                                          */
/* ------------------------------------------------------------------ */

describe('cancellation mid-stream', () => {
  it('releases the slot when cancelled while fetching', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/cancel', [{ kind: 'abort' }]);
    const controller = new AbortController();

    const result = await driveFetch(lifecycle, provider, 'tile/cancel', {
      timeoutMs: 5000,
      clock,
      signal: controller.signal,
    });

    expect(result.degraded).toBe('cancelled');
    expect(statusOf(lifecycle, 'tile/cancel')).toBe('released');
    expect(lifecycle.get('tile/cancel')!.bytes).toBe(0);
  });

  it('aborts after bytes arrive still releases instead of caching partial data', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/late-abort', [{ kind: 'ok', bytes: 4096, latencyMs: 10 }]);
    const controller = new AbortController();
    controller.abort();

    const result = await driveFetch(lifecycle, provider, 'tile/late-abort', {
      timeoutMs: 5000,
      clock,
      signal: controller.signal,
    });

    expect(result.degraded).toBe('cancelled');
    expect(statusOf(lifecycle, 'tile/late-abort')).toBe('released');
  });

  it('a released tile can be re-queued (released -> queued is reachable)', () => {
    const lifecycle = new TileResourceLifecycle();
    lifecycle.markFetching('tile/rq');
    lifecycle.markReleased('tile/rq');
    lifecycle.markQueued('tile/rq');
    expect(statusOf(lifecycle, 'tile/rq')).toBe('queued');
  });
});

/* ------------------------------------------------------------------ */
/* 3. Partial coverage (some tiles present)                            */
/* ------------------------------------------------------------------ */

describe('partial coverage', () => {
  it('marks present tiles ready and missing tiles failed — never zero-filled', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/present-a', [{ kind: 'ok', bytes: 2048, latencyMs: 5 }]);
    provider.script('tile/present-b', [{ kind: 'ok', bytes: 1024, latencyMs: 5 }]);
    provider.script('tile/missing', [{ kind: 'http', status: 404 }]);

    const ids = ['tile/present-a', 'tile/present-b', 'tile/missing'];
    for (const id of ids) {
      await driveFetch(lifecycle, provider, id, { timeoutMs: 5000, clock });
    }

    expect(statusOf(lifecycle, 'tile/present-a')).toBe('ready');
    expect(statusOf(lifecycle, 'tile/present-b')).toBe('ready');
    expect(statusOf(lifecycle, 'tile/missing')).toBe('failed');
    expect(lifecycle.get('tile/missing')!.lastError).toBe('provider 404');

    // Ready tiles are consumable; the missing tile is guarded.
    expect(() => lifecycle.assertNotSynthetic('tile/present-a')).not.toThrow();
    expect(() => lifecycle.assertNotSynthetic('tile/missing')).toThrow(/not ready/);

    // The planner keeps fetching only what is not resident.
    const plan = lifecycle.plan(ids, clock.now());
    expect(plan.toFetch).toEqual(['tile/missing']);
    expect(plan.residentBytes).toBe(3072);
  });

  it('reports partial coverage as a labeled fraction, not silent interpolation', () => {
    const lifecycle = new TileResourceLifecycle();
    const ids = ['c/1', 'c/2', 'c/3', 'c/4'];
    lifecycle.markReady('c/1', 100);
    lifecycle.markReady('c/2', 100);
    lifecycle.markFailed('c/3', 'provider 503');
    // c/4 never attempted -> idle/missing
    const ready = ids.filter((id) => lifecycle.get(id)?.status === 'ready').length;
    const coverage = ready / ids.length;
    expect(coverage).toBe(0.5);
    expect(lifecycle.get('c/3')!.status).toBe('failed'); // labeled, not zero-filled
    expect(lifecycle.get('c/4')).toBeUndefined(); // missing, not invented
  });
});

/* ------------------------------------------------------------------ */
/* 4. Stale cache (expired vs acquisition time)                        */
/* ------------------------------------------------------------------ */

describe('stale cache', () => {
  const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30-day freshness policy

  function evaluateFreshness(
    lifecycle: TileResourceLifecycle,
    id: string,
    acquiredAt: number,
    now: number,
    ttlMs: number,
  ): 'fresh' | 'stale' {
    if (now - acquiredAt > ttlMs) {
      lifecycle.markStale(id, now);
      return 'stale';
    }
    return 'fresh';
  }

  it('keeps a fresh tile ready and labels an expired one stale', () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const acquiredAt = clock.now();
    lifecycle.markReady('tile/cache', 512, acquiredAt);

    // 10 days later: still fresh.
    clock.advance(10 * 24 * 60 * 60 * 1000);
    expect(evaluateFreshness(lifecycle, 'tile/cache', acquiredAt, clock.now(), TTL_MS)).toBe('fresh');
    expect(statusOf(lifecycle, 'tile/cache')).toBe('ready');

    // 40 days later: expired -> stale label.
    clock.advance(30 * 24 * 60 * 60 * 1000);
    expect(evaluateFreshness(lifecycle, 'tile/cache', acquiredAt, clock.now(), TTL_MS)).toBe('stale');
    const rec = lifecycle.get('tile/cache')!;
    expect(rec.status).toBe('stale');
    expect(rec.bytes).toBe(512); // stale keeps its bytes: usable, labeled
  });

  it('stale tiles stay resident in the plan and remain consumable (labeled)', () => {
    const lifecycle = new TileResourceLifecycle();
    lifecycle.markReady('tile/s', 700);
    lifecycle.markStale('tile/s');
    const plan = lifecycle.plan(['tile/s']);
    expect(plan.residentBytes).toBe(700);
    expect(plan.toFetch).toEqual([]);
    expect(() => lifecycle.assertNotSynthetic('tile/s')).not.toThrow();
  });

  it('a stale tile can be refreshed back to ready (stale -> ready reachable)', () => {
    const lifecycle = new TileResourceLifecycle();
    lifecycle.markReady('tile/ref', 100, 1);
    lifecycle.markStale('tile/ref', 2);
    lifecycle.markReady('tile/ref', 120, 3);
    const rec = lifecycle.get('tile/ref')!;
    expect(rec.status).toBe('ready');
    expect(rec.bytes).toBe(120);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Provider failure (5xx / empty body)                              */
/* ------------------------------------------------------------------ */

describe('provider failure', () => {
  it('surfaces a 5xx as a labeled failed state, never a thrown gate', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/5xx', [{ kind: 'http', status: 503 }]);

    let result: FetchResult | undefined;
    await expect(
      (async () => {
        result = await driveFetch(lifecycle, provider, 'tile/5xx', { timeoutMs: 5000, clock });
      })(),
    ).resolves.toBeUndefined();

    expect(result).toMatchObject({ ok: false, degraded: 'provider-error', detail: 'provider 503' });
    const rec = lifecycle.get('tile/5xx')!;
    expect(rec.status).toBe('failed');
    expect(rec.lastError).toBe('provider 503');
    expect(rec.bytes).toBe(0);
  });

  it('treats an empty body as a failure, not as zero-byte success', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/empty', [{ kind: 'empty' }]);

    const result = await driveFetch(lifecycle, provider, 'tile/empty', { timeoutMs: 5000, clock });
    expect(result).toMatchObject({ ok: false, degraded: 'empty-body' });
    expect(statusOf(lifecycle, 'tile/empty')).toBe('failed');
    // Empty must not masquerade as a ready zero-byte tile.
    expect(() => lifecycle.assertNotSynthetic('tile/empty')).toThrow(/not ready/);
  });

  it('does not count failed bytes toward the resident budget', () => {
    const lifecycle = new TileResourceLifecycle();
    lifecycle.markFailed('tile/f1', 'provider 500');
    lifecycle.markFailed('tile/f2', 'timeout after 5000ms');
    const plan = lifecycle.plan(['tile/f1', 'tile/f2']);
    expect(plan.residentBytes).toBe(0);
    expect(plan.toFetch.sort()).toEqual(['tile/f1', 'tile/f2']);
  });
});

/* ------------------------------------------------------------------ */
/* 6. Recovery: retry then success                                     */
/* ------------------------------------------------------------------ */

describe('recovery', () => {
  it('retries a failed tile and lands ready on the second attempt', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle({ maxInFlight: 4 });
    const provider = new FakeTileProvider();
    provider.script('tile/flaky', [
      { kind: 'http', status: 503 },
      { kind: 'ok', bytes: 8192, latencyMs: 20 },
    ]);

    const first = await driveFetch(lifecycle, provider, 'tile/flaky', { timeoutMs: 5000, clock });
    expect(first).toMatchObject({ ok: false, degraded: 'provider-error' });
    expect(statusOf(lifecycle, 'tile/flaky')).toBe('failed');

    // Planner re-offers failed ids: failed -> queued -> fetching -> ready.
    expect(lifecycle.plan(['tile/flaky'], clock.now()).toFetch).toContain('tile/flaky');
    const second = await driveFetch(lifecycle, provider, 'tile/flaky', { timeoutMs: 5000, clock });
    expect(second.ok).toBe(true);
    const rec = lifecycle.get('tile/flaky')!;
    expect(rec.status).toBe('ready');
    expect(rec.bytes).toBe(8192);
  });

  it('recovers from timeout the same way', async () => {
    const clock = makeClock();
    const lifecycle = new TileResourceLifecycle();
    const provider = new FakeTileProvider();
    provider.script('tile/slow', [{ kind: 'hang' }, { kind: 'ok', bytes: 256, latencyMs: 1 }]);

    await driveFetch(lifecycle, provider, 'tile/slow', { timeoutMs: 1000, clock });
    expect(statusOf(lifecycle, 'tile/slow')).toBe('failed');
    await driveFetch(lifecycle, provider, 'tile/slow', { timeoutMs: 1000, clock });
    expect(statusOf(lifecycle, 'tile/slow')).toBe('ready');
  });
});

/* ------------------------------------------------------------------ */
/* 7. Full transition matrix + planner/budget behavior                 */
/* ------------------------------------------------------------------ */

describe('state machine transitions', () => {
  const mark: Record<
    Exclude<TileResourceStatus, 'idle'>,
    (l: TileResourceLifecycle, id: string) => void
  > = {
    queued: (l, id) => l.markQueued(id),
    fetching: (l, id) => l.markFetching(id),
    ready: (l, id) => l.markReady(id, 64),
    stale: (l, id) => l.markStale(id),
    failed: (l, id) => l.markFailed(id, 'boom'),
    released: (l, id) => l.markReleased(id),
  };

  it('every mark* transition is reachable from every status (total setters)', () => {
    for (const from of ALL_STATUSES) {
      for (const to of Object.keys(mark) as (keyof typeof mark)[]) {
        const lifecycle = new TileResourceLifecycle();
        const id = `t/${from}/${to}`;
        if (from !== 'idle') mark[from](lifecycle, id);
        mark[to](lifecycle, id);
        expect(statusOf(lifecycle, id), `${from} -> ${to}`).toBe(to);
      }
    }
  });

  it('assertNotSynthetic guards every non-consumable status', () => {
    const lifecycle = new TileResourceLifecycle();
    const guarded: TileResourceStatus[] = ['idle', 'failed', 'released'];
    for (const s of guarded) {
      const id = `g/${s}`;
      if (s === 'failed') lifecycle.markFailed(id, 'x');
      if (s === 'released') lifecycle.markReleased(id);
      expect(() => lifecycle.assertNotSynthetic(id), s).toThrow(/not ready/);
    }
    for (const s of ['queued', 'fetching', 'ready', 'stale'] as const) {
      const id = `g/${s}`;
      mark[s](lifecycle, id);
      expect(() => lifecycle.assertNotSynthetic(id), s).not.toThrow();
    }
  });

  it('constructor rejects degenerate budgets', () => {
    expect(() => new TileResourceLifecycle({ maxInFlight: 0 })).toThrow(RangeError);
    expect(() => new TileResourceLifecycle({ maxReadyBytes: 0 })).toThrow(RangeError);
  });

  it('markReady rejects non-finite or negative byte counts', () => {
    const lifecycle = new TileResourceLifecycle();
    expect(() => lifecycle.markReady('t', -1)).toThrow(RangeError);
    expect(() => lifecycle.markReady('t', Number.NaN)).toThrow(RangeError);
  });

  it('bounds in-flight fetches and releases non-desired residents', () => {
    const lifecycle = new TileResourceLifecycle({ maxInFlight: 2, maxReadyBytes: 1_000_000 });
    const plan1 = lifecycle.plan(['a', 'b', 'c', 'd']);
    expect(plan1.toFetch).toEqual(['a', 'b']); // maxInFlight bound
    for (const id of plan1.toFetch) lifecycle.markQueued(id);

    lifecycle.markReady('old-1', 500);
    lifecycle.markReady('old-2', 600);
    const plan2 = lifecycle.plan(['a', 'b']);
    expect(plan2.toRelease.sort()).toEqual(['old-1', 'old-2']); // non-desired released
    expect(plan2.residentBytes).toBe(1100);
  });

  it('records updatedAt from the injected clock on every transition', () => {
    const clock = makeClock(7_000);
    const lifecycle = new TileResourceLifecycle();
    const seen: number[] = [];
    lifecycle.markQueued('t', clock.now());
    seen.push(lifecycle.get('t')!.updatedAt);
    clock.advance(5);
    lifecycle.markFetching('t', clock.now());
    seen.push(lifecycle.get('t')!.updatedAt);
    clock.advance(5);
    lifecycle.markReady('t', 10, clock.now());
    seen.push(lifecycle.get('t')!.updatedAt);
    clock.advance(5);
    lifecycle.markStale('t', clock.now());
    seen.push(lifecycle.get('t')!.updatedAt);
    expect(seen).toEqual([7000, 7005, 7010, 7015]);
  });
});

/* ------------------------------------------------------------------ */
/* 8. Manifest binding: coverage labels never fabricate                */
/* ------------------------------------------------------------------ */

describe('manifest coverage binding', () => {
  // Mirrors the AOI manifest contract: an asset is either VERIFIED (hash),
  // PROVISIONAL (provider claim), or UNAVAILABLE — never zero-filled.
  type CoverageLabel = 'VERIFIED' | 'PROVISIONAL' | 'UNAVAILABLE';
  function labelFor(asset: { sha256: string | null; held: boolean }): CoverageLabel {
    if (asset.sha256) return 'VERIFIED';
    if (asset.held) return 'PROVISIONAL';
    return 'UNAVAILABLE';
  }

  it('labels held hashed assets VERIFIED, held unhashed PROVISIONAL, missing UNAVAILABLE', () => {
    expect(labelFor({ sha256: 'abc123', held: true })).toBe('VERIFIED');
    expect(labelFor({ sha256: null, held: true })).toBe('PROVISIONAL');
    expect(labelFor({ sha256: null, held: false })).toBe('UNAVAILABLE');
  });

  it('an UNAVAILABLE asset stays missing in the lifecycle (never synthesized)', () => {
    const lifecycle = new TileResourceLifecycle();
    // Wabash IL NFHL county clip: no held asset, no fetch attempted.
    expect(lifecycle.get('nfhl-flood-zones-17185')).toBeUndefined();
    expect(() => lifecycle.assertNotSynthetic('nfhl-flood-zones-17185')).toThrow(/not ready/);
  });
});
