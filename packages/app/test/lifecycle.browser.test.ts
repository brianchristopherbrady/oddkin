// Page suspension and restoration in a real document (core-contracts.md §9.1, ADR 0035), with
// real PageTransitionEvent objects dispatched on the window: application services suspend and
// resume, nothing is disposed, listeners are registered once and only by the explicit service,
// and resources with a restore policy load again. These events are synthetic; a real
// back/forward cache restoration is proven in e2e/lifecycle.spec.ts.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const LIFECYCLE = [
  'pagehide',
  'pageshow',
  'visibilitychange',
  'freeze',
  'resume',
  'unload',
  'beforeunload',
];

/** Lifecycle listeners registered on the window or the document while recording. */
let recorded: string[] = [];
let recording = false;
const record = (target: 'window' | 'document', type: string) => {
  if (recording && LIFECYCLE.includes(type)) recorded.push(`${target}:${type}`);
};
type Rest = [EventListenerOrEventListenerObject | null, (boolean | AddEventListenerOptions)?];
const prototypeAdd = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: Rest) {
  if (this === document) record('document', type);
  return prototypeAdd.call(this, type, ...rest);
};
// The test runner gives the window an addEventListener of its own, which bypasses the prototype.
const windowAdd = window.addEventListener;
window.addEventListener = function (
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) {
  record('window', type);
  return windowAdd.call(window, type, listener, options);
} as typeof window.addEventListener;

let container: HTMLElement;
beforeEach(() => {
  recorded = [];
  recording = true;
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  recording = false;
  container.remove();
});

const settle = async () => {
  const { flush } = await import('@oddkin/core/reactive');
  for (let i = 0; i < 5; i++) await Promise.resolve();
  flush();
};
const transition = (type: 'pagehide' | 'pageshow', persisted: boolean) =>
  window.dispatchEvent(new PageTransitionEvent(type, { persisted }));

describe('page lifecycle in a real document', () => {
  it('importing every entry and connecting components registers no lifecycle listener', async () => {
    await Promise.all([
      import('@oddkin/core'),
      import('@oddkin/core/reactive'),
      import('@oddkin/core/scope'),
      import('@oddkin/core/template'),
      import('@oddkin/core/styles'),
      import('@oddkin/core/layout'),
      import('@oddkin/core/collections'),
      import('@oddkin/core/model'),
      import('@oddkin/core/element'),
      import('@oddkin/core/diagnostics'),
      import('@oddkin/core/controllers/focus'),
      import('@oddkin/core/controllers/announce'),
      import('@oddkin/core/controllers/observe'),
      import('@oddkin/core/controllers/form'),
      import('@oddkin/core/i18n'),
      import('@oddkin/components'),
      import('@oddkin/components/define/button'),
      import('@oddkin/components/define/card'),
      import('@oddkin/components/define/input'),
      import('@oddkin/components/define/side-nav'),
      import('@oddkin/state'),
      import('@oddkin/state/store'),
      import('@oddkin/state/context'),
      import('@oddkin/state/inspect'),
      import('@oddkin/state/persist'),
      import('@oddkin/app'),
      import('@oddkin/app/app'),
      import('@oddkin/app/resource'),
      import('@oddkin/app/command'),
      import('@oddkin/app/router'),
      import('@oddkin/app/lifecycle'),
    ]);
    const form = document.createElement('form');
    form.innerHTML =
      '<odd-card><odd-input label="Name" name="name"></odd-input><odd-button>Save</odd-button></odd-card><odd-side-nav label="Pages"></odd-side-nav>';
    container.append(form);
    await customElements.whenDefined('odd-input');
    await settle();
    expect(form.querySelector('odd-input')!.shadowRoot).not.toBeNull();
    expect(recorded).toEqual([]);
  });

  it('suspends and resumes the services of an application that uses pageLifecycle', async () => {
    const { createApp } = await import('../src/app/index.js');
    const { pageLifecycle } = await import('../src/lifecycle/index.js');
    const { scopeStats } = await import('@oddkin/core/scope');
    const log: string[] = [];
    let ticks = 0;
    const app = createApp({
      name: 'shop',
      setup({ app: self, scope, use }) {
        const lifecycle = use(pageLifecycle(self));
        // A poller: its interval lives on a child scope that suspension ends and resumption renews.
        let polling = scope.child();
        const poll = () => polling.interval(() => ticks++, 10);
        poll();
        use({
          connect() {},
          suspend() {
            log.push('suspend');
            polling.dispose();
          },
          resume() {
            log.push('resume');
            polling = scope.child();
            poll();
          },
        });
        return lifecycle;
      },
    });
    const baseline = scopeStats();
    const lifecycle = app.start();
    const freeze = 'onfreeze' in document;
    expect(recorded).toEqual([
      'window:pagehide',
      'window:pageshow',
      'document:visibilitychange',
      ...(freeze ? ['document:freeze', 'document:resume'] : []),
    ]);
    const running = scopeStats();
    expect(running.listeners - baseline.listeners).toBe(freeze ? 5 : 3);

    for (let round = 1; round <= 3; round++) {
      transition('pagehide', true);
      expect(app.suspended).toBe(true);
      expect(scopeStats().timers).toBe(running.timers - 1); // the poller paused
      expect(scopeStats().listeners).toBe(running.listeners); // nothing disposed
      const paused = ticks;
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(ticks).toBe(paused);
      transition('pageshow', true);
      expect(app.suspended).toBe(false);
      expect(scopeStats()).toEqual(running); // nothing duplicated
      expect(lifecycle.state.value.restorations).toBe(round);
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(ticks).toBeGreaterThan(0);
    expect(log).toEqual(['suspend', 'resume', 'suspend', 'resume', 'suspend', 'resume']);
    expect(recorded).toHaveLength(freeze ? 5 : 3); // registered once

    transition('pagehide', false); // unloading for good: nothing happens
    transition('pageshow', false);
    expect(log).toHaveLength(6);

    if (freeze) {
      document.dispatchEvent(new Event('freeze'));
      expect(app.suspended).toBe(true);
      document.dispatchEvent(new Event('resume'));
      expect(app.suspended).toBe(false);
      expect(lifecycle.state.value.restorations).toBe(3); // freezing is no restoration
    }
    expect(lifecycle.state.value.visible).toBe(document.visibilityState === 'visible');

    app.stop();
    expect(scopeStats()).toEqual(baseline);
    transition('pagehide', true);
    transition('pageshow', true);
    expect(log).toHaveLength(freeze ? 8 : 6);
  });

  it('an element’s resource with revalidateOnRestore loads again; without the service, nothing listens', async () => {
    const { OddkinElement, define } = await import('@oddkin/core/element');
    const { html } = await import('@oddkin/core/template');
    const { createApp } = await import('../src/app/index.js');
    const { pageLifecycle } = await import('../src/lifecycle/index.js');
    const { resource } = await import('../src/resource/index.js');
    let loads = 0;
    class LifecycleNews extends OddkinElement {
      readonly news = resource({
        source: () => 'headlines',
        load: async () => `edition ${++loads}`,
        revalidateOnRestore: true,
      });
      protected override connected(scope: import('@oddkin/core/scope').Scope) {
        scope.use(this.news); // no lifecycle code in the element
      }
      protected override render() {
        const state = this.news.state.value;
        return html`<output>${state.status === 'success' ? state.value : state.status}</output>`;
      }
    }
    define('lifecycle-news', LifecycleNews);
    const shown = async (el: LifecycleNews) => {
      await settle();
      await el.updateComplete;
      return el.shadowRoot!.querySelector('output')!.textContent;
    };
    const el = document.createElement('lifecycle-news') as LifecycleNews;
    container.append(el);
    expect(await shown(el)).toBe('edition 1');
    expect(recorded).toEqual([]); // the element listens to nothing

    transition('pagehide', true);
    transition('pageshow', true);
    expect(await shown(el)).toBe('edition 1'); // no service: nothing observed the restoration

    const app = createApp({ setup: ({ app: self, use }) => void use(pageLifecycle(self)) });
    app.start();
    transition('pagehide', true);
    transition('pageshow', true);
    expect(await shown(el)).toBe('edition 2');
    el.remove();
    transition('pagehide', true);
    transition('pageshow', true);
    await settle();
    expect(loads).toBe(2); // a disconnected element's resource stays put
    app.stop();
  });
});
