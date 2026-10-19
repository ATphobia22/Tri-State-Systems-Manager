/**
 * Opt-in session live shadow — NOT continuous live 4D product default.
 *
 * - Default OFF (button-only remains product default).
 * - When ON: periodic multi-station fetch for this browser session only.
 * - Stale banner when age > STALE_MS; auto-stop after MAX_SESSION_MS.
 * - Failures leave prior snapshot; never fabricate stages/WSE.
 */

import { fetchAllLiveStations, type StationLiveSnapshot } from './multi-stage-fetch';
import { fetchLiveStage } from './stage';
import type { MapTwinLoaderData } from '../types/loaders';

export const LIVE_SHADOW_POLL_MS = 60_000;
export const LIVE_SHADOW_STALE_MS = 15 * 60_000;
export const LIVE_SHADOW_MAX_SESSION_MS = 30 * 60_000;

export type LiveShadowStatus = {
  enabled: boolean;
  lastFetchAt: string | null;
  ageMs: number | null;
  stale: boolean;
  error: string | null;
  ticks: number;
  sessionStartedAt: string | null;
  autoStoppedReason: string | null;
};

export type LiveShadowCallbacks = {
  onStations: (snaps: StationLiveSnapshot[]) => void;
  onPrimaryStage: (stage: MapTwinLoaderData['stage']) => void;
  onStatus: (status: LiveShadowStatus) => void;
};

export class SessionLiveShadow {
  private timer: ReturnType<typeof setInterval> | null = null;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;
  private lastFetchAt: string | null = null;
  private sessionStartedAt: string | null = null;
  private ticks = 0;
  private error: string | null = null;
  private autoStoppedReason: string | null = null;
  private busy = false;

  constructor(private readonly cb: LiveShadowCallbacks) {}

  getStatus(): LiveShadowStatus {
    const ageMs =
      this.lastFetchAt != null ? Date.now() - Date.parse(this.lastFetchAt) : null;
    return {
      enabled: this.enabled,
      lastFetchAt: this.lastFetchAt,
      ageMs,
      stale: ageMs != null && ageMs > LIVE_SHADOW_STALE_MS,
      error: this.error,
      ticks: this.ticks,
      sessionStartedAt: this.sessionStartedAt,
      autoStoppedReason: this.autoStoppedReason,
    };
  }

  private emit(): void {
    this.cb.onStatus(this.getStatus());
  }

  async tick(): Promise<void> {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    this.error = null;
    try {
      const snaps = await fetchAllLiveStations();
      this.cb.onStations(snaps);
      const primary = await fetchLiveStage();
      this.cb.onPrimaryStage(primary);
      this.lastFetchAt = new Date().toISOString();
      this.ticks += 1;
      if (snaps.every((s) => s.status === 'unavailable') && primary.source === 'UNAVAILABLE') {
        this.error = 'Shadow tick: all stations unavailable (resilient; no fabricated values).';
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Shadow tick failed';
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.autoStoppedReason = null;
    this.sessionStartedAt = new Date().toISOString();
    this.emit();
    void this.tick();
    this.timer = setInterval(() => void this.tick(), LIVE_SHADOW_POLL_MS);
    this.sessionTimer = setTimeout(() => {
      this.stop('auto_stop_max_session');
    }, LIVE_SHADOW_MAX_SESSION_MS);
  }

  stop(reason: string | null = null): void {
    this.enabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (reason) this.autoStoppedReason = reason;
    this.emit();
  }

  dispose(): void {
    this.stop(null);
  }
}
