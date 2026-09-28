type RuntimeRouter = { subscribe: (listener: (state: { location?: { pathname?: string }; navigation?: { state?: string } }) => void) => () => void };

type MetricLabels = Record<string, string | number | boolean>;
const ENDPOINT = '/api/runtime/metrics';
const queue: Array<{ name: string; value: number; labels: MetricLabels }> = [];
let flushTimer: number | undefined;

function enqueue(name: string, value: number, labels: MetricLabels = {}): void {
  if (!Number.isFinite(value) || queue.length >= 256) return;
  queue.push({ name, value, labels });
  if (queue.length >= 20) void flush();
  else if (flushTimer === undefined) flushTimer = window.setTimeout(() => { flushTimer = undefined; void flush(); }, 5000);
}
async function flush(): Promise<void> {
  if (!queue.length) return;
  const batch = queue.splice(0, 64);
  const body = JSON.stringify({ metrics: batch });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    await fetch(ENDPOINT, { method: 'POST', body, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true });
  } catch { queue.unshift(...batch.slice(0, Math.max(0, 256 - queue.length))); }
}
function isTileResource(url: string): boolean {
  return /(?:\.pbf|\.mvt|\.terrain|\.b3dm|\.i3dm|\.cmpt|\.glb|\.gltf|\/tiles?\/|\/3dtiles\/)/i.test(url);
}
function installResourceObserver(): void {
  if (!('PerformanceObserver' in window)) return;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      const url = entry.name;
      if (/\.js(?:\?|$)/i.test(url) && entry.transferSize > 0) enqueue('tsm_browser_js_chunk_bytes', entry.transferSize, { resource_class: 'javascript_chunk' });
    }
  });
  try { observer.observe({ type: 'resource', buffered: true }); } catch { observer.disconnect(); }
}
function installFetchTileObserver(): void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const tile = isTileResource(url);
    const started = performance.now();
    try {
      const response = await originalFetch(input, init);
      if (tile) {
        enqueue('tsm_browser_tile_requests_total', 1, { outcome: response.ok ? 'success' : 'http_error' });
        enqueue('tsm_browser_tile_request_latency_seconds', (performance.now() - started) / 1000, { outcome: response.ok ? 'success' : 'http_error' });
        if (!response.ok) enqueue('tsm_browser_tile_failures_total', 1, { status: response.status });
      }
      return response;
    } catch (error) {
      if (tile) {
        enqueue('tsm_browser_tile_requests_total', 1, { outcome: 'network_error' });
        enqueue('tsm_browser_tile_request_latency_seconds', (performance.now() - started) / 1000, { outcome: 'network_error' });
        enqueue('tsm_browser_tile_failures_total', 1, { status: 'network_error' });
      }
      throw error;
    }
  };
}
function installFrameObserver(): void {
  // Frame telemetry runs on a time budget instead of per frame: deltas are
  // accumulated and the window average is reported at most every 500 ms.
  // The RAF loop is fully paused while the tab is hidden (visibilitychange)
  // and resumed on return — no per-frame work, no queue growth, no battery
  // drain in the background.
  const FRAME_REPORT_INTERVAL_MS = 500;
  const MEMORY_REPORT_INTERVAL_MS = 5000;
  let previous = performance.now();
  let rafId = 0;
  let stopped = false;
  let windowStart = previous;
  let windowFrames = 0;
  let windowDeltaSumMs = 0;
  let lastMemoryReport = 0;
  const reportWindow = (now: number): void => {
    if (windowFrames > 0) {
      enqueue('tsm_browser_frame_time_seconds', windowDeltaSumMs / windowFrames / 1000, { frame_source: 'requestAnimationFrame' });
    }
    windowStart = now;
    windowFrames = 0;
    windowDeltaSumMs = 0;
    if (now - lastMemoryReport >= MEMORY_REPORT_INTERVAL_MS) {
      lastMemoryReport = now;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      if (memory && memory.jsHeapSizeLimit > 0) enqueue('tsm_browser_memory_pressure_ratio', memory.usedJSHeapSize / memory.jsHeapSizeLimit);
    }
  };
  const tick = (now: number): void => {
    if (stopped) return;
    const delta = now - previous;
    previous = now;
    if (delta > 0 && delta < 1000) {
      windowFrames += 1;
      windowDeltaSumMs += delta;
    }
    if (now - windowStart >= FRAME_REPORT_INTERVAL_MS) reportWindow(now);
    rafId = requestAnimationFrame(tick);
  };
  const onVisibility = (): void => {
    if (document.hidden) {
      stopped = true;
      cancelAnimationFrame(rafId);
    } else if (stopped) {
      stopped = false;
      previous = performance.now();
      windowStart = previous;
      windowFrames = 0;
      windowDeltaSumMs = 0;
      rafId = requestAnimationFrame(tick);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  rafId = requestAnimationFrame(tick);
}
function installGraphicsCapabilityProbe(): void {
  enqueue('tsm_browser_webgpu_available', 'gpu' in navigator ? 1 : 0);
  const canvas = document.createElement('canvas');
  const available = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  enqueue('tsm_browser_webgl_available', available ? 1 : 0);
}
function installNavigationObserver(router: RuntimeRouter): void {
  const initial = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (initial) enqueue('tsm_browser_route_load_seconds', initial.duration / 1000, { route: location.pathname });
  let navigationStart = performance.now();
  let previousPath = location.pathname;
  return void router.subscribe((state) => {
    if (state.location?.pathname && state.location.pathname !== previousPath) {
      previousPath = state.location.pathname;
      navigationStart = performance.now();
      return;
    }
    if (state.navigation?.state === 'idle' && previousPath === state.location?.pathname) {
      const elapsed = performance.now() - navigationStart;
      if (elapsed > 0 && elapsed < 120_000) enqueue('tsm_browser_route_load_seconds', elapsed / 1000, { route: previousPath });
    }
  });
}
/**
 * Shared visibility guard for polling loops (gauge boards, live-data hooks).
 * Polling sites should skip their tick while the tab is hidden instead of
 * burning battery/network on updates nobody sees. Call sites:
 *   - RiverGaugeBoard.tsx (5 min setInterval)
 *   - startGaugePoll in lib/river-gauges.ts (60 s default)
 */
export function shouldSkipPoll(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

/**
 * Visibility-aware interval: runs `callback` every `intervalMs` but silently
 * skips ticks while the tab is hidden. Returns a stop function like
 * clearInterval.
 */
export function startVisibleInterval(callback: () => void, intervalMs: number): () => void {
  let cancelled = false;
  const tick = (): void => {
    if (cancelled) return;
    if (shouldSkipPoll()) return;
    try { callback(); } catch { /* next tick */ }
  };
  const id = window.setInterval(tick, intervalMs);
  return () => { cancelled = true; window.clearInterval(id); };
}

export function installRuntimePerformanceTelemetry(router: RuntimeRouter): void {
  if (typeof window === 'undefined') return;
  installResourceObserver();
  installFetchTileObserver();
  installFrameObserver();
  installGraphicsCapabilityProbe();
  installNavigationObserver(router);
  window.addEventListener('pagehide', () => { void flush(); }, { once: true });
}
