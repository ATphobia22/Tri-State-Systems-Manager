/**
 * Tests for ContextRecoveryManager state machine:
 * active -> lost -> restoring -> restored/active, and lost -> failed -> retry.
 * Uses a fake canvas (no DOM required).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ContextRecoveryManager,
  type ContextLossCanvas,
} from '../lib/webgl-context-recovery';

class FakeCanvas implements ContextLossCanvas {
  private listeners = new Map<string, Array<(e: Event) => void>>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((l) => l !== listener),
    );
  }

  listenerCount(type: string): number {
    return (this.listeners.get(type) ?? []).length;
  }

  dispatch(type: string): { preventDefault: () => void; defaultPrevented: boolean } {
    let defaultPrevented = false;
    const event = {
      type,
      preventDefault: () => {
        defaultPrevented = true;
      },
    } as unknown as Event;
    for (const l of this.listeners.get(type) ?? []) l(event);
    return {
      preventDefault: event.preventDefault as () => void,
      get defaultPrevented() {
        return defaultPrevented;
      },
    };
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ContextRecoveryManager', () => {
  it('starts in active state with empty snapshot', () => {
    const mgr = new ContextRecoveryManager();
    expect(mgr.getState()).toBe('active');
    expect(mgr.snapshot()).toEqual({
      state: 'active',
      lossCount: 0,
      rebuildCallbacks: [],
      lastError: null,
    });
    mgr.dispose();
  });

  it('attaches listeners and detaches cleanly', () => {
    const canvas = new FakeCanvas();
    const mgr = new ContextRecoveryManager();
    mgr.attach(canvas);
    expect(canvas.listenerCount('webglcontextlost')).toBe(1);
    expect(canvas.listenerCount('webglcontextrestored')).toBe(1);
    mgr.detach();
    expect(canvas.listenerCount('webglcontextlost')).toBe(0);
    expect(canvas.listenerCount('webglcontextrestored')).toBe(0);
    mgr.dispose();
  });

  it('context lost: prevents default, shows indicator, records loss', async () => {
    const canvas = new FakeCanvas();
    const indicator = vi.fn();
    const states: string[] = [];
    const mgr = new ContextRecoveryManager({
      onIndicator: indicator,
      onStateChange: (s) => states.push(s),
    });
    mgr.attach(canvas);

    const dispatched = canvas.dispatch('webglcontextlost');
    await flush();

    expect(dispatched.defaultPrevented).toBe(true);
    expect(mgr.getState()).toBe('lost');
    expect(mgr.snapshot().lossCount).toBe(1);
    expect(indicator).toHaveBeenCalledWith(true, expect.stringContaining('restoring'));
    expect(states).toContain('lost');
    mgr.dispose();
  });

  it('duplicate lost events are ignored', async () => {
    const canvas = new FakeCanvas();
    const mgr = new ContextRecoveryManager();
    mgr.attach(canvas);
    canvas.dispatch('webglcontextlost');
    canvas.dispatch('webglcontextlost');
    await flush();
    expect(mgr.snapshot().lossCount).toBe(1);
    mgr.dispose();
  });

  it('restore runs rebuild callbacks in order and returns to active', async () => {
    const canvas = new FakeCanvas();
    const order: string[] = [];
    const indicator = vi.fn();
    const states: string[] = [];
    const mgr = new ContextRecoveryManager({
      onIndicator: indicator,
      onStateChange: (s) => states.push(s),
    });
    mgr.registerRebuildCallback('textures', () => {
      order.push('textures');
    });
    mgr.registerRebuildCallback('buffers', async () => {
      order.push('buffers');
    });
    mgr.attach(canvas);

    canvas.dispatch('webglcontextlost');
    await flush();
    canvas.dispatch('webglcontextrestored');
    await flush();

    expect(order).toEqual(['textures', 'buffers']);
    expect(mgr.getState()).toBe('active');
    expect(indicator).toHaveBeenLastCalledWith(false, '');
    expect(states).toEqual(expect.arrayContaining(['lost', 'restoring', 'restored', 'active']));
    mgr.dispose();
  });

  it('restored event while active is ignored', async () => {
    const canvas = new FakeCanvas();
    const rebuild = vi.fn();
    const mgr = new ContextRecoveryManager();
    mgr.registerRebuildCallback('x', rebuild);
    mgr.attach(canvas);
    canvas.dispatch('webglcontextrestored');
    await flush();
    expect(rebuild).not.toHaveBeenCalled();
    expect(mgr.getState()).toBe('active');
    mgr.dispose();
  });

  it('failing rebuild enters failed state; retry recovers', async () => {
    const canvas = new FakeCanvas();
    const indicator = vi.fn();
    let shouldFail = true;
    const mgr = new ContextRecoveryManager({ onIndicator: indicator });
    mgr.registerRebuildCallback('gpu', () => {
      if (shouldFail) throw new Error('shader compile failed');
    });
    mgr.attach(canvas);

    canvas.dispatch('webglcontextlost');
    await flush();
    canvas.dispatch('webglcontextrestored');
    await flush();

    expect(mgr.getState()).toBe('failed');
    expect(mgr.snapshot().lastError).toContain('shader compile failed');
    expect(indicator).toHaveBeenLastCalledWith(true, expect.stringContaining('could not be restored'));

    // Manual retry after the underlying problem is fixed.
    shouldFail = false;
    const ok = await mgr.retryRestore();
    expect(ok).toBe(true);
    expect(mgr.getState()).toBe('active');
    mgr.dispose();
  });

  it('one failing callback does not stop the others', async () => {
    const canvas = new FakeCanvas();
    const ran: string[] = [];
    const mgr = new ContextRecoveryManager();
    mgr.registerRebuildCallback('bad', () => {
      throw new Error('boom');
    });
    mgr.registerRebuildCallback('good', () => {
      ran.push('good');
    });
    mgr.attach(canvas);
    canvas.dispatch('webglcontextlost');
    await flush();
    canvas.dispatch('webglcontextrestored');
    await flush();
    expect(ran).toEqual(['good']);
    expect(mgr.getState()).toBe('failed');
    mgr.dispose();
  });

  it('retryRestore when not failed resolves true without rebuilding', async () => {
    const mgr = new ContextRecoveryManager();
    const rebuild = vi.fn();
    mgr.registerRebuildCallback('x', rebuild);
    expect(await mgr.retryRestore()).toBe(true);
    expect(rebuild).not.toHaveBeenCalled();
    mgr.dispose();
  });

  it('register validates name and callback; re-register replaces', () => {
    const mgr = new ContextRecoveryManager();
    expect(() => mgr.registerRebuildCallback('', () => {})).toThrow(RangeError);
    expect(() =>
      mgr.registerRebuildCallback('x', 'nope' as unknown as () => void),
    ).toThrow(TypeError);
    const first = vi.fn();
    const second = vi.fn();
    mgr.registerRebuildCallback('x', first);
    mgr.registerRebuildCallback('x', second);
    expect(mgr.snapshot().rebuildCallbacks).toEqual(['x']);
    expect(mgr.unregisterRebuildCallback('x')).toBe(true);
    expect(mgr.unregisterRebuildCallback('x')).toBe(false);
    mgr.dispose();
  });

  it('attach after dispose throws', () => {
    const mgr = new ContextRecoveryManager();
    mgr.dispose();
    expect(() => mgr.attach(new FakeCanvas())).toThrow('disposed');
  });
});
