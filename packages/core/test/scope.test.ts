import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { flush, signal } from '../src/reactive/index.js';
import { scopeStats } from '../src/scope/scope.js';
import { createScope, type Scope } from '../src/scope/index.js';
import { scopeReasonCases } from './scope-reasons.js';

let reported: Array<{ error: unknown; context: ErrorContext }>;

beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
});

afterEach(() => {
  vi.useRealTimers();
  flush();
  setErrorHandler(undefined);
});

scopeReasonCases();

describe('Scope cleanup', () => {
  it('runs cleanups once, in reverse registration order', () => {
    const scope = createScope();
    const order: string[] = [];
    scope.add(() => order.push('first'));
    scope.add(() => order.push('second'));
    scope.add(() => order.push('third'));
    scope.dispose();
    scope.dispose();
    expect(order).toEqual(['third', 'second', 'first']);
    expect(scope.disposed).toBe(true);
  });

  it('releases early at most once and drops the cleanup from disposal', () => {
    const scope = createScope();
    const cleanup = vi.fn();
    const release = scope.add(cleanup);
    release();
    release();
    scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs every cleanup even when some throw, and reports with origin', () => {
    const scope = createScope({ name: 'profile-card' });
    const after = vi.fn();
    scope.add(after);
    scope.add(() => {
      throw new Error('boom');
    });
    scope.dispose();
    expect(after).toHaveBeenCalled();
    expect(reported.map((r) => [r.context.code, r.context.origin])).toEqual([
      ['scope.cleanup.error', 'profile-card'],
    ]);
    expect(String(reported[0]?.error)).toContain('in scope "profile-card"');
  });

  it('runs cleanups added after disposal immediately and starts nothing new', () => {
    vi.useFakeTimers();
    const scope = createScope();
    scope.dispose();
    const cleanup = vi.fn();
    scope.add(cleanup);
    expect(cleanup).toHaveBeenCalled();
    const timer = vi.fn();
    scope.timeout(timer, 10);
    scope.interval(timer, 10);
    const target = new EventTarget();
    const handler = vi.fn();
    scope.listen(target, 'ping', handler);
    const run = vi.fn();
    scope.effect(run);
    const controller = { connect: vi.fn() };
    scope.use(controller);
    vi.advanceTimersByTime(100);
    target.dispatchEvent(new Event('ping'));
    expect([timer, handler, run, controller.connect].map((fn) => fn.mock.calls.length)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(scope.child().disposed).toBe(true);
  });
});

describe('Scope signal', () => {
  it('aborts with the dispose reason', () => {
    const scope = createScope();
    const { signal: abortSignal } = scope;
    expect(abortSignal.aborted).toBe(false);
    const reason = new Error('route changed');
    scope.dispose(reason);
    expect(abortSignal.aborted).toBe(true);
    expect(abortSignal.reason).toBe(reason);
  });

  it('returns an already aborted signal after disposal', () => {
    const scope = createScope();
    scope.dispose();
    expect(scope.signal.aborted).toBe(true);
  });
});

describe('Scope.listen', () => {
  it('removes listeners on dispose and on early release', () => {
    const scope = createScope();
    const target = new EventTarget();
    const a = vi.fn();
    const b = vi.fn();
    const releaseA = scope.listen(target, 'ping', a);
    scope.listen(target, 'ping', b);
    target.dispatchEvent(new Event('ping'));
    releaseA();
    target.dispatchEvent(new Event('ping'));
    scope.dispose();
    target.dispatchEvent(new Event('ping'));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('preserves listener options', () => {
    const scope = createScope();
    const target = new EventTarget();
    const once = vi.fn();
    scope.listen(target, 'ping', once, { once: true });
    target.dispatchEvent(new Event('ping'));
    target.dispatchEvent(new Event('ping'));
    expect(once).toHaveBeenCalledTimes(1);
    scope.dispose();
  });
});

describe('Scope timers', () => {
  it('runs and cancels timeouts', () => {
    vi.useFakeTimers();
    const scope = createScope();
    const fired = vi.fn();
    const cancelled = vi.fn();
    scope.timeout(fired, 10);
    const release = scope.timeout(cancelled, 10);
    release();
    vi.advanceTimersByTime(10);
    expect(fired).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
    scope.dispose();
  });

  it('repeats intervals until disposed and reports callback errors', () => {
    vi.useFakeTimers();
    const scope = createScope({ name: 'clock' });
    let ticks = 0;
    scope.interval(() => {
      ticks++;
      if (ticks === 2) throw new Error('tick failed');
    }, 100);
    vi.advanceTimersByTime(350);
    scope.dispose();
    vi.advanceTimersByTime(500);
    expect(ticks).toBe(3);
    expect(reported.map((r) => [r.context.code, r.context.origin])).toEqual([
      ['scope.timer.error', 'clock'],
    ]);
  });
});

describe('Scope children', () => {
  it('disposes children with the parent', () => {
    const parent = createScope();
    const child = parent.child();
    const grandchild = child.child();
    const cleanup = vi.fn();
    grandchild.add(cleanup);
    parent.dispose();
    expect([child.disposed, grandchild.disposed]).toEqual([true, true]);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('detaches a child disposed early from its parent', () => {
    const parent = createScope();
    const child = parent.child();
    const cleanup = vi.fn();
    child.add(cleanup);
    child.dispose();
    parent.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('Scope.effect', () => {
  it('gives each run a fresh child scope and disposes the previous one first', () => {
    const scope = createScope();
    const room = signal('lobby');
    const target = new EventTarget();
    const log: string[] = [];
    scope.effect((run) => {
      const name = room.value;
      log.push(`join ${name}`);
      run.listen(target, 'message', () => log.push(`message in ${name}`));
      return () => log.push(`leave ${name}`);
    });
    target.dispatchEvent(new Event('message'));
    room.value = 'kitchen';
    flush();
    target.dispatchEvent(new Event('message'));
    scope.dispose();
    target.dispatchEvent(new Event('message'));
    room.value = 'garden';
    flush();
    expect(log).toEqual([
      'join lobby',
      'message in lobby',
      'leave lobby',
      'join kitchen',
      'message in kitchen',
      'leave kitchen',
    ]);
  });

  it('disposes the run scope when the run throws', () => {
    const scope = createScope();
    const cleanup = vi.fn();
    scope.effect((run) => {
      run.add(cleanup);
      throw new Error('setup failed');
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(reported.map((r) => r.context.code)).toEqual(['reactive.effect.error']);
    scope.dispose();
  });
});

describe('Scope.use', () => {
  it('connects a controller that registers its own cleanup', () => {
    const scope = createScope();
    const log: string[] = [];
    const controller = {
      connect(owner: Scope) {
        log.push('connect');
        owner.add(() => log.push('disconnect'));
      },
    };
    expect(scope.use(controller)).toBe(controller);
    scope.dispose();
    expect(log).toEqual(['connect', 'disconnect']);
  });
});

describe('lifetime instrumentation', () => {
  it('returns to baseline after 1,000 mount/dispose cycles', () => {
    vi.useFakeTimers();
    const baseline = scopeStats();
    const source = signal(0);
    const target = new EventTarget();
    for (let i = 0; i < 1000; i++) {
      const scope = createScope();
      scope.listen(target, 'ping', () => {});
      scope.timeout(() => {}, 1000);
      scope.interval(() => {}, 1000);
      scope.effect((run) => {
        source.value;
        run.listen(target, 'pong', () => {});
      });
      scope.child().listen(target, 'ping', () => {});
      scope.dispose();
    }
    expect(scopeStats()).toEqual(baseline);
  });
});
