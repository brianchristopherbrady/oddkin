import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { effect, flush } from '@oddkin/core/reactive';
import { scopeStats, type Scope } from '@oddkin/core/scope';
import { createApp, type AppContext, type AppService } from '../src/app/index.js';

// Application ownership (core-contracts.md §9): one root scope per run, explicit services,
// idempotent start/stop, restart with fresh ownership, independent applications.

let reported: { error: unknown; context: ErrorContext }[];
beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
});
afterEach(() => {
  flush();
  setErrorHandler(undefined);
});

describe('createApp', () => {
  it('does nothing until start(); start() runs setup with a fresh scope and returns its services', () => {
    const setup = vi.fn((context: AppContext) => ({ started: context.scope }));
    const app = createApp({ name: 'shop', setup });
    expect(setup).not.toHaveBeenCalled();
    expect([app.running, app.services]).toEqual([false, undefined]);
    const services = app.start();
    expect(setup).toHaveBeenCalledTimes(1);
    expect(services.started.disposed).toBe(false);
    expect(app.services).toBe(services);
    expect(app.running).toBe(true);
    expect(app.start()).toBe(services); // idempotent while running
    expect(setup).toHaveBeenCalledTimes(1);
    app.stop();
    expect([app.running, app.services]).toEqual([false, undefined]);
  });

  it('stop() disposes the run: cleanups in reverse order, the signal aborted; idempotent', () => {
    const baseline = scopeStats();
    const order: string[] = [];
    let signal: AbortSignal | undefined;
    const app = createApp({
      setup({ scope, signal: runSignal }) {
        signal = runSignal;
        scope.add(() => order.push('first'));
        scope.add(() => order.push('second'));
        scope.interval(() => {}, 1000);
        scope.listen(new EventTarget(), 'ping', () => {});
        scope.child().add(() => order.push('child'));
      },
    });
    app.start();
    expect(scopeStats()).not.toEqual(baseline);
    app.stop();
    app.stop();
    expect(order).toEqual(['child', 'second', 'first']);
    expect(signal!.aborted).toBe(true);
    expect(signal!.reason).toBeInstanceOf(DOMException);
    expect((signal!.reason as DOMException).name).toBe('AbortError');
    expect([app.running, app.services]).toEqual([false, undefined]);
    expect(scopeStats()).toEqual(baseline);

    const reason = new Error('shutting down');
    app.start();
    app.stop(reason);
    expect(signal!.reason).toBe(reason);
  });

  it('restarts with fresh ownership and fresh services', () => {
    const runs: Scope[] = [];
    const app = createApp({
      setup({ scope }) {
        runs.push(scope);
        return { id: runs.length };
      },
    });
    expect(app.start()).toEqual({ id: 1 });
    app.stop();
    expect(app.start()).toEqual({ id: 2 });
    expect(runs[0]!.disposed).toBe(true);
    expect(runs[1]!.disposed).toBe(false);
    expect(runs[0]).not.toBe(runs[1]);
    app.stop();
  });

  it('leaves the application stopped, with partial work disposed, when setup throws', () => {
    const baseline = scopeStats();
    const disposed = vi.fn();
    let fail = true;
    const app = createApp({
      setup({ scope }) {
        scope.add(disposed);
        scope.interval(() => {}, 1000);
        if (fail) throw new Error('bad config');
        return 'ok';
      },
    });
    expect(() => app.start()).toThrow('bad config');
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(app.running).toBe(false);
    expect(scopeStats()).toEqual(baseline);
    fail = false;
    expect(app.start()).toBe('ok');
    app.stop();
  });

  it('rejects start() and stop() inside setup and start() inside a stopping cleanup', () => {
    const inSetup = (call: 'start' | 'stop') => {
      const app = createApp({
        setup({ app: self }) {
          self[call]();
        },
      });
      expect(() => app.start()).toThrow(
        expect.objectContaining({ code: 'app.lifecycle.reentrant' }),
      );
      expect(app.running).toBe(false);
    };
    inSetup('start');
    inSetup('stop');

    const app = createApp({
      setup({ scope, app: self }) {
        scope.add(() => self.stop()); // already stopping: no-op
        scope.add(() => self.start());
      },
    });
    app.start();
    app.stop();
    expect(app.running).toBe(false);
    expect(reported.map((r) => r.context.code)).toEqual(['scope.cleanup.error']);
    expect(((reported[0]!.error as Error).cause as { code: string }).code).toBe(
      'app.lifecycle.reentrant',
    );
    app.start(); // stop completed: the application can start again
    expect(app.running).toBe(true);
    app.stop();
  });

  it('reports a throwing cleanup and still completes the stop', () => {
    const later = vi.fn();
    const app = createApp({
      setup({ scope }) {
        scope.add(later);
        scope.add(() => {
          throw new Error('cleanup failed');
        });
      },
    });
    app.start();
    app.stop();
    expect(later).toHaveBeenCalledTimes(1);
    expect(reported.map((r) => r.context.code)).toEqual(['scope.cleanup.error']);
    expect(app.running).toBe(false);
  });

  it('activates services for the run with use(); they end with it', () => {
    const events: string[] = [];
    class Poller implements AppService {
      connect(scope: Scope) {
        events.push('connect');
        scope.add(() => events.push('disconnect'));
      }
    }
    const app = createApp({ setup: ({ use }) => ({ poller: use(new Poller()) }) });
    const { poller } = app.start();
    expect(poller).toBeInstanceOf(Poller);
    expect(events).toEqual(['connect']);
    app.stop();
    expect(events).toEqual(['connect', 'disconnect']);
  });

  it('keeps two applications independent', () => {
    const a = createApp({ name: 'a', setup: ({ signal }) => ({ signal }) });
    const b = createApp({ name: 'b', setup: ({ signal }) => ({ signal }) });
    const runA = a.start();
    const runB = b.start();
    a.stop();
    expect(runA.signal.aborted).toBe(true);
    expect(runB.signal.aborted).toBe(false);
    expect([a.running, b.running]).toEqual([false, true]);
    expect(b.services).toBe(runB);
    b.stop();
  });

  it('tracks running for effects and templates', () => {
    const app = createApp({ setup: () => {} });
    const seen: boolean[] = [];
    const stop = effect(() => void seen.push(app.running));
    app.start();
    flush();
    app.stop();
    flush();
    expect(seen).toEqual([false, true, false]);
    stop();
  });

  it('cannot provide context without a root', () => {
    const app = createApp({
      setup({ provide }) {
        provide({ name: 'theme' } as never, 'dark');
      },
    });
    expect(() => app.start()).toThrow(expect.objectContaining({ code: 'app.root.missing' }));
    expect(app.running).toBe(false);
  });
});
