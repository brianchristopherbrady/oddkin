import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OddkinError, setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { flush, signal } from '@oddkin/core/reactive';
import { createScope, scopeStats, type Scope } from '@oddkin/core/scope';
import { createApp, type AppService } from '../src/app/index.js';
import { command } from '../src/command/index.js';
import { pageLifecycle } from '../src/lifecycle/index.js';
import { resource } from '../src/resource/index.js';

// Page suspension and restoration (core-contracts.md §9.1, ADR 0035): application suspend/resume,
// the explicit page-lifecycle service, and the resource restore policy, with a fake window in Node.

interface FakePage {
  readonly window: Window;
  /** Event types registered on the window and the document, in order (including removed ones). */
  readonly registered: string[];
  /** Listeners currently registered, by `target:type`. */
  active(): Record<string, number>;
  hide(persisted: boolean): Event;
  show(persisted: boolean): Event;
  fire(target: 'window' | 'document', type: string): void;
  setVisibility(state: 'visible' | 'hidden'): void;
}

function fakePage({ freeze = true } = {}): FakePage {
  const registered: string[] = [];
  const active = new Map<string, number>();
  const track = <T extends EventTarget>(target: T, name: string): T => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type: string, ...rest: [never, never?]) => {
      registered.push(type);
      active.set(`${name}:${type}`, (active.get(`${name}:${type}`) ?? 0) + 1);
      add(type, ...rest);
    };
    target.removeEventListener = (type: string, ...rest: [never, never?]) => {
      active.set(`${name}:${type}`, (active.get(`${name}:${type}`) ?? 0) - 1);
      remove(type, ...rest);
    };
    return target;
  };
  const doc = track(
    Object.assign(new EventTarget(), {
      visibilityState: 'visible' as DocumentVisibilityState,
      ...(freeze ? { onfreeze: null } : {}),
    }),
    'document',
  );
  const win = track(Object.assign(new EventTarget(), { document: doc }), 'window');
  const transition = (type: string, persisted: boolean) => {
    const event = Object.assign(new Event(type), { persisted });
    win.dispatchEvent(event);
    return event;
  };
  return {
    window: win as unknown as Window,
    registered,
    active: () => Object.fromEntries([...active].filter(([, count]) => count !== 0)),
    hide: (persisted) => transition('pagehide', persisted),
    show: (persisted) => transition('pageshow', persisted),
    fire: (target, type) => (target === 'window' ? win : doc).dispatchEvent(new Event(type)),
    setVisibility(state) {
      doc.visibilityState = state;
      doc.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

/** A service that records its hooks. */
function recorder(name: string, log: string[]): AppService {
  return {
    connect: () => log.push(`${name}:connect`),
    suspend: () => log.push(`${name}:suspend`),
    resume: () => log.push(`${name}:resume`),
  };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  flush();
};

let reported: { error: unknown; context: ErrorContext }[];
beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
});
afterEach(() => {
  flush();
  vi.useRealTimers();
  setErrorHandler(undefined);
});

describe('app.suspend() and app.resume()', () => {
  it('call the services in reverse order and in order, and dispose nothing', () => {
    const log: string[] = [];
    let scope!: Scope;
    const app = createApp({
      name: 'shop',
      setup(context) {
        scope = context.scope;
        context.use(recorder('a', log));
        context.use({ connect: () => log.push('plain:connect') }); // no hooks
        context.use(recorder('b', log));
        context.scope.interval(() => {}, 1000);
      },
    });
    app.suspend(); // not running: no-op
    expect(app.suspended).toBe(false);
    app.start();
    const before = scopeStats();
    log.length = 0;
    app.suspend();
    expect(app.suspended).toBe(true);
    expect(log).toEqual(['b:suspend', 'a:suspend']);
    app.suspend(); // idempotent
    expect(log).toEqual(['b:suspend', 'a:suspend']);
    expect(scope.disposed).toBe(false);
    expect(scope.signal.aborted).toBe(false);
    expect(scopeStats()).toEqual(before); // timers, listeners, and scopes are kept
    app.resume();
    app.resume(); // idempotent
    expect(app.suspended).toBe(false);
    expect(log).toEqual(['b:suspend', 'a:suspend', 'a:resume', 'b:resume']);
    app.stop();
    app.resume();
    expect(log).toHaveLength(4);
    expect(reported).toEqual([]);
  });

  it('report a throwing service and still call the others', () => {
    const log: string[] = [];
    const failure = new Error('socket refused');
    const app = createApp({
      name: 'shop',
      setup({ use }) {
        use(recorder('a', log));
        use({
          connect() {},
          suspend() {
            throw failure;
          },
          resume() {
            throw failure;
          },
        });
        use(recorder('b', log));
      },
    });
    app.start();
    app.suspend();
    app.resume();
    expect(log).toEqual([
      'a:connect',
      'b:connect',
      'b:suspend',
      'a:suspend',
      'a:resume',
      'b:resume',
    ]);
    expect(reported).toEqual([
      { error: failure, context: { code: 'app.service.suspend', origin: 'shop' } },
      { error: failure, context: { code: 'app.service.resume', origin: 'shop' } },
    ]);
    app.stop();
  });

  it('reject suspend or resume inside a pass; stop() inside a pass ends it', () => {
    const log: string[] = [];
    const stopping = createApp({
      setup({ app: self, use }) {
        use(recorder('a', log));
        use({ connect() {}, suspend: () => self.stop() });
        use(recorder('b', log));
      },
    });
    stopping.start();
    log.length = 0;
    stopping.suspend(); // reverse order: b, then the stopping service; a is never called
    expect(log).toEqual(['b:suspend']);
    expect(stopping.running).toBe(false);
    expect(stopping.suspended).toBe(false);

    const reentrant = createApp({
      setup({ app: self, use }) {
        use(recorder('a', log));
        use({ connect() {}, suspend: () => self.resume(), resume: () => self.suspend() });
        use(recorder('b', log));
      },
    });
    reentrant.start();
    log.length = 0;
    reentrant.suspend();
    expect(log).toEqual(['b:suspend', 'a:suspend']);
    expect(reentrant.suspended).toBe(true);
    log.length = 0;
    reentrant.resume();
    expect(log).toEqual(['a:resume', 'b:resume']);
    expect(reentrant.suspended).toBe(false);
    expect(reported.map((entry) => entry.context.code)).toEqual([
      'app.service.suspend',
      'app.service.resume',
    ]);
    for (const entry of reported) {
      expect((entry.error as OddkinError).code).toBe('app.lifecycle.reentrant');
    }
    reentrant.stop();
  });

  it('a stop while suspended clears suspension; a restart starts resumed', () => {
    const log: string[] = [];
    let used!: (service: AppService) => void;
    const app = createApp({
      setup({ use }) {
        used = use;
        use(recorder('a', log));
      },
    });
    app.start();
    app.suspend();
    used(recorder('late', log)); // used while suspended: suspended at once
    expect(log).toEqual(['a:connect', 'a:suspend', 'late:connect', 'late:suspend']);
    app.resume();
    expect(log.slice(4)).toEqual(['a:resume', 'late:resume']);
    app.suspend();
    app.stop();
    expect(app.suspended).toBe(false);
    log.length = 0;
    app.start();
    expect(app.suspended).toBe(false);
    expect(log).toEqual(['a:connect']);
    app.stop();
  });
});

describe('pageLifecycle()', () => {
  it('suspends for the back/forward cache and resumes on restoration, with listeners registered once', () => {
    const page = fakePage();
    const log: string[] = [];
    const app = createApp({
      name: 'shop',
      setup({ app: self, use }) {
        const lifecycle = use(pageLifecycle(self, { window: page.window }));
        use(recorder('poller', log));
        return lifecycle;
      },
    });
    const baseline = scopeStats().listeners;
    const lifecycle = app.start();
    expect(page.registered).toEqual([
      'pagehide',
      'pageshow',
      'visibilitychange',
      'freeze',
      'resume',
    ]);
    expect(scopeStats().listeners).toBe(baseline + 5);
    expect(lifecycle.state.value).toEqual({ visible: true, suspended: false, restorations: 0 });

    page.hide(false); // unloading for good: nothing suspended, nothing disposed
    page.show(false); // a fresh document
    expect(app.suspended).toBe(false);

    for (let round = 1; round <= 3; round++) {
      page.hide(true);
      expect(app.suspended).toBe(true);
      expect(lifecycle.state.value).toMatchObject({ suspended: true, restorations: round - 1 });
      page.show(true);
      expect(app.suspended).toBe(false);
      expect(lifecycle.state.value).toEqual({
        visible: true,
        suspended: false,
        restorations: round,
      });
    }
    expect(log.filter((entry) => entry !== 'poller:connect')).toEqual([
      'poller:suspend',
      'poller:resume',
      'poller:suspend',
      'poller:resume',
      'poller:suspend',
      'poller:resume',
    ]);
    expect(page.registered).toHaveLength(5); // never registered again
    expect(page.registered).not.toContain('unload');
    expect(page.registered).not.toContain('beforeunload');
    expect(scopeStats().listeners).toBe(baseline + 5);

    app.stop();
    expect(page.active()).toEqual({});
    expect(scopeStats().listeners).toBe(baseline);
    page.hide(true);
    page.show(true);
    expect(log).toHaveLength(7); // a stopped application hears nothing
    expect(reported).toEqual([]);
  });

  it('suspends while frozen; freeze and the cache overlap without a double resume', () => {
    const page = fakePage();
    const log: string[] = [];
    const app = createApp({
      setup({ app: self, use }) {
        use(recorder('s', log));
        return use(pageLifecycle(self, { window: page.window }));
      },
    });
    const lifecycle = app.start();
    log.length = 0;
    page.fire('document', 'freeze');
    expect(lifecycle.state.value).toMatchObject({ suspended: true });
    page.fire('document', 'resume');
    expect(lifecycle.state.value).toMatchObject({ suspended: false, restorations: 0 });
    expect(log).toEqual(['s:suspend', 's:resume']);

    // Chromium's back/forward cache: pagehide, freeze, then resume, pageshow.
    log.length = 0;
    page.hide(true);
    page.fire('document', 'freeze');
    page.fire('document', 'resume');
    expect(app.suspended).toBe(true); // still in the cache until pageshow
    page.show(true);
    expect(log).toEqual(['s:suspend', 's:resume']);
    expect(lifecycle.state.value.restorations).toBe(1);

    // A restored page is active, even if no resume event came after a freeze.
    log.length = 0;
    page.fire('document', 'freeze');
    page.hide(true);
    page.show(true);
    expect(app.suspended).toBe(false);
    expect(log).toEqual(['s:suspend', 's:resume']);
    app.stop();
  });

  it('ignores freeze where the browser lacks it or the option is off; follows visibility', () => {
    for (const [page, freeze] of [
      [fakePage({ freeze: false }), true],
      [fakePage(), false],
    ] as const) {
      const app = createApp({
        setup: ({ app: self, use }) => use(pageLifecycle(self, { window: page.window, freeze })),
      });
      const lifecycle = app.start();
      expect(page.registered).toEqual(['pagehide', 'pageshow', 'visibilitychange']);
      page.fire('document', 'freeze');
      expect(app.suspended).toBe(false);
      page.setVisibility('hidden');
      expect(lifecycle.state.value).toEqual({ visible: false, suspended: false, restorations: 0 });
      page.setVisibility('visible');
      expect(lifecycle.state.value.visible).toBe(true);
      app.stop();
    }
  });

  it('leaves a manual suspension alone, and reads as resumed after a stop', () => {
    const page = fakePage();
    const log: string[] = [];
    const app = createApp({
      setup({ app: self, use }) {
        use(recorder('s', log));
        return use(pageLifecycle(self, { window: page.window }));
      },
    });
    const lifecycle = app.start();
    app.suspend(); // the application's own decision
    page.setVisibility('hidden');
    page.setVisibility('visible');
    expect(app.suspended).toBe(true);
    app.resume();
    page.hide(true);
    expect(lifecycle.state.value.suspended).toBe(true);
    app.stop(); // stopped while in the cache
    expect(lifecycle.state.value.suspended).toBe(false);
    expect(app.suspended).toBe(false);
    expect(log).toEqual(['s:connect', 's:suspend', 's:resume', 's:suspend']);
  });

  it('needs a window: starting without one fails with app.lifecycle.environment', () => {
    const app = createApp({ setup: ({ app: self, use }) => void use(pageLifecycle(self)) });
    expect(() => app.start()).toThrow(
      expect.objectContaining({ code: 'app.lifecycle.environment' }),
    );
    expect(app.running).toBe(false);
  });
});

describe('the restore policy', () => {
  /** An application following `page`, owning `resources`. */
  function host(page: FakePage, ...resources: { connect(scope: Scope): void }[]) {
    const app = createApp({
      setup({ app: self, scope, use }) {
        use(pageLifecycle(self, { window: page.window }));
        for (const owned of resources) scope.use(owned);
      },
    });
    app.start();
    return app;
  }

  it('loads again after a restoration only with revalidateOnRestore', async () => {
    const page = fakePage();
    let n = 0;
    const load = vi.fn(async (key: string) => `${key} #${++n}`);
    const revalidating = resource({ source: () => 'news', load, revalidateOnRestore: true });
    const keeping = resource({ source: () => 'weather', load });
    const app = host(page, revalidating, keeping);
    await settle();
    expect(revalidating.state.value).toEqual({ status: 'success', key: 'news', value: 'news #1' });
    expect(keeping.state.value).toEqual({ status: 'success', key: 'weather', value: 'weather #2' });

    page.hide(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(2); // suspension starts nothing
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(3);
    expect(revalidating.state.value).toEqual({ status: 'success', key: 'news', value: 'news #3' });
    expect(keeping.state.value).toEqual({ status: 'success', key: 'weather', value: 'weather #2' });

    page.show(false); // a non-persisted pageshow is no restoration
    page.hide(false);
    await settle();
    expect(load).toHaveBeenCalledTimes(3);
    app.stop();
  });

  it('keeps a success younger than freshFor; revalidates an older one, or an error', async () => {
    vi.useFakeTimers({ now: 1_000_000, toFake: ['Date'] });
    const page = fakePage();
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return Date.now();
    });
    const data = resource({
      source: () => 'k',
      load,
      revalidateOnRestore: true,
      freshFor: 60_000,
    });
    const app = host(page, data);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_059_999);
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(1); // still fresh

    fail = true;
    data.refresh(); // fails while the success is still young
    await settle();
    expect(data.state.value).toMatchObject({ status: 'error', previous: { value: 1_000_000 } });
    fail = false;
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(3); // an error is loaded again, however young the success
    expect(data.state.value).toMatchObject({ status: 'success', value: 1_059_999 });

    vi.setSystemTime(1_059_999 + 60_000);
    fail = true;
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(4); // older than freshFor; the failure surfaces as error
    expect(data.state.value).toMatchObject({
      status: 'error',
      error: { message: 'offline' },
      previous: { key: 'k', value: 1_059_999 },
    });
    app.stop();
  });

  it('supersedes a load pending across the suspension; its late result never wins', async () => {
    const page = fakePage();
    const pending: { resolve(value: string): void; signal: AbortSignal }[] = [];
    const data = resource({
      source: () => 'k',
      load: (_key: string, { signal: abort }) =>
        new Promise<string>((resolve) => pending.push({ resolve, signal: abort })),
      revalidateOnRestore: true,
    });
    const app = host(page, data);
    page.hide(true);
    page.show(true);
    await settle();
    expect(pending).toHaveLength(2);
    expect(pending[0]!.signal.aborted).toBe(true);
    pending[1]!.resolve('fresh');
    await settle();
    pending[0]!.resolve('stale');
    await settle();
    expect(data.state.value).toEqual({ status: 'success', key: 'k', value: 'fresh' });
    app.stop();
  });

  it('does nothing while disconnected or idle, or without a running lifecycle service', async () => {
    const page = fakePage();
    const key = signal<string | undefined>(undefined);
    const load = vi.fn(async (k: string) => k);
    const idle = resource({ source: () => key.value, load, revalidateOnRestore: true });
    const loose = resource({ source: () => 'x', load, revalidateOnRestore: true });
    const app = host(page, idle);
    const owner = createScope();
    owner.use(loose);
    await settle();
    expect(load).toHaveBeenCalledTimes(1); // loose; idle has no key
    owner.dispose(); // loose disconnected
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);

    app.stop(); // no service listens any more
    const again = createScope();
    again.use(loose);
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    again.dispose();
  });

  it('follows only its current connection', async () => {
    const page = fakePage();
    const load = vi.fn(async () => 'v');
    const data = resource({ source: () => 'k', load, revalidateOnRestore: true });
    const app = host(page);
    const first = createScope();
    const second = createScope();
    first.use(data);
    await settle();
    second.use(data); // connected elsewhere while the first scope lives on
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(3); // once, for the current connection
    first.dispose();
    second.dispose();
    app.stop();
  });

  it('counts one restoration for several applications on the page', async () => {
    const page = fakePage();
    const load = vi.fn(async () => 'v');
    const data = resource({ source: () => 'k', load, revalidateOnRestore: true });
    const first = host(page, data);
    // A browser runs microtasks between the listeners of a native event, so effects can flush
    // between two applications' listeners; a listener that flushes stands in for that here.
    page.window.addEventListener('pageshow', () => flush());
    const second = host(page);
    await settle();
    page.hide(true);
    page.show(true);
    await settle();
    expect(load).toHaveBeenCalledTimes(2); // one revalidation, not two
    first.stop();
    second.stop();
  });

  it('never retries a command across a restoration', async () => {
    const page = fakePage();
    const run = vi.fn(
      (_input: string, { signal: abort }: { signal: AbortSignal }) =>
        new Promise<string>((resolve) => abort.addEventListener('abort', () => resolve('x'))),
    );
    const save = command({ run });
    const app = host(page, save);
    const outcome = save.run('draft');
    page.hide(true);
    page.show(true);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(save.state.value).toMatchObject({ status: 'pending', attempt: 1 });
    app.stop();
    expect((await outcome).status).toBe('cancelled');
  });
});
