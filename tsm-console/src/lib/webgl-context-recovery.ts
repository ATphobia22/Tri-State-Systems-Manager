/**
 * webgl-context-recovery.ts — WebGL context-loss handling for TSM.
 *
 * Browsers can revoke the WebGL context at any time (GPU reset, driver
 * update, tab resource pressure, mobile OS reclaim). Without handling,
 * the 3D view goes black and never recovers. This module implements the
 * standard recovery pattern:
 *
 *   webglcontextlost      -> pause rendering, preserve app state,
 *                            show "Graphics paused — restoring..." indicator
 *   webglcontextrestored  -> re-run registered GPU-resource rebuild
 *                            callbacks (textures, buffers, programs), resume
 *   restore failure       -> show error + offer manual retry
 *
 * This is the management/logic layer only: it does not upload textures or
 * compile shaders itself. Render layers register rebuild callbacks via
 * registerRebuildCallback() and perform their own GPU work inside them.
 *
 * Key browser rule: the default action on 'webglcontextlost' must be
 * prevented (event.preventDefault()), otherwise the context can never
 * be restored.
 */

export type ContextRecoveryState =
  | 'active'
  | 'lost'
  | 'restoring'
  | 'restored'
  | 'failed';

/** Minimal canvas surface: real HTMLCanvasElement satisfies this. */
export interface ContextLossCanvas {
  addEventListener(type: string, listener: (event: Event) => void, options?: unknown): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

/** Rebuild callback: re-create one layer's GPU resources. May be async. */
export type RebuildCallback = () => void | Promise<void>;

export interface RecoveryStateSnapshot {
  state: ContextRecoveryState;
  /** Number of times the context has been lost since attach. */
  lossCount: number;
  /** Registered rebuild callback names, in registration order. */
  rebuildCallbacks: string[];
  /** Last error message, if state is 'failed'. */
  lastError: string | null;
}

export interface ContextRecoveryOptions {
  /**
   * Called to show/hide the user-facing indicator.
   * Default is a no-op; the host app wires this to its UI.
   */
  onIndicator?: (visible: boolean, message: string) => void;
  /**
   * Called on every state transition. Default no-op.
   */
  onStateChange?: (state: ContextRecoveryState) => void;
}

const DEFAULT_MESSAGE_LOST = 'Graphics paused — restoring…';
const DEFAULT_MESSAGE_FAILED = 'Graphics could not be restored.';

export class ContextRecoveryManager {
  private canvas: ContextLossCanvas | null = null;
  private state: ContextRecoveryState = 'active';
  private lossCount = 0;
  private lastError: string | null = null;
  private readonly rebuildCallbacks = new Map<string, RebuildCallback>();
  private readonly options: Pick<ContextRecoveryOptions, 'onIndicator' | 'onStateChange'>;
  private readonly boundOnLost: (event: Event) => void;
  private readonly boundOnRestored: () => void;
  private disposed = false;

  constructor(options: ContextRecoveryOptions = {}) {
    this.options = {
      onIndicator: options.onIndicator,
      onStateChange: options.onStateChange,
    };
    this.boundOnLost = (event: Event) => {
      // Prevent default: without this the context can never be restored.
      if (typeof (event as { preventDefault?: () => void }).preventDefault === 'function') {
        (event as { preventDefault: () => void }).preventDefault();
      }
      void this.handleContextLost();
    };
    this.boundOnRestored = () => {
      void this.handleContextRestored();
    };
  }

  /** Attach listeners to the canvas. Safe to call once; re-attach disposes first. */
  attach(canvas: ContextLossCanvas): void {
    if (this.disposed) throw new Error('ContextRecoveryManager has been disposed');
    this.detach();
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', this.boundOnLost, false);
    canvas.addEventListener('webglcontextrestored', this.boundOnRestored, false);
  }

  detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.boundOnLost);
      this.canvas.removeEventListener('webglcontextrestored', this.boundOnRestored);
      this.canvas = null;
    }
  }

  dispose(): void {
    this.detach();
    this.rebuildCallbacks.clear();
    this.disposed = true;
  }

  /**
   * Register a GPU-resource rebuild callback. Layers call this for each
   * resource group (e.g. 'tiles-3d-textures', 'flood-layer-buffers').
   * Re-registering the same name replaces the previous callback.
   */
  registerRebuildCallback(name: string, fn: RebuildCallback): void {
    if (!name) throw new RangeError('Rebuild callback name must be non-empty');
    if (typeof fn !== 'function') throw new TypeError('Rebuild callback must be a function');
    this.rebuildCallbacks.set(name, fn);
  }

  unregisterRebuildCallback(name: string): boolean {
    return this.rebuildCallbacks.delete(name);
  }

  getState(): ContextRecoveryState {
    return this.state;
  }

  snapshot(): RecoveryStateSnapshot {
    return {
      state: this.state,
      lossCount: this.lossCount,
      rebuildCallbacks: [...this.rebuildCallbacks.keys()],
      lastError: this.lastError,
    };
  }

  /**
   * Manual retry after a failed restore. Re-runs all rebuild callbacks.
   * Returns true if the retry succeeded (state returns to 'active').
   */
  async retryRestore(): Promise<boolean> {
    if (this.state !== 'failed') return this.state === 'restored' || this.state === 'active';
    this.setState('restoring');
    const ok = await this.runRebuild();
    if (ok) {
      this.setState('restored');
      this.options.onIndicator?.(false, '');
      this.setState('active');
    }
    return ok;
  }

  private setState(next: ContextRecoveryState): void {
    this.state = next;
    this.options.onStateChange?.(next);
  }

  private async handleContextLost(): Promise<void> {
    // Ignore duplicate loss events while already handling one.
    if (this.state === 'lost' || this.state === 'restoring') return;
    this.lossCount += 1;
    this.lastError = null;
    this.setState('lost');
    // Pause rendering: the host stops its RAF loop when it sees 'lost'.
    // Show the restoring indicator immediately; the browser fires
    // 'webglcontextrestored' asynchronously when the GPU is ready again.
    this.options.onIndicator?.(true, DEFAULT_MESSAGE_LOST);
  }

  private async handleContextRestored(): Promise<void> {
    if (this.state !== 'lost') return;
    this.setState('restoring');
    const ok = await this.runRebuild();
    if (ok) {
      this.setState('restored');
      this.options.onIndicator?.(false, '');
      // Settle back to 'active' so a future loss is handled fresh.
      this.setState('active');
    }
  }

  /**
   * Run all rebuild callbacks in registration order. A single failing
   * callback does not stop the others; failures are collected and the
   * manager enters 'failed' if any failed.
   */
  private async runRebuild(): Promise<boolean> {
    const failures: string[] = [];
    for (const [name, fn] of this.rebuildCallbacks) {
      try {
        await fn();
      } catch (err) {
        failures.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (failures.length > 0) {
      this.lastError = failures.join('; ');
      this.setState('failed');
      this.options.onIndicator?.(true, DEFAULT_MESSAGE_FAILED);
      return false;
    }
    this.lastError = null;
    return true;
  }
}
