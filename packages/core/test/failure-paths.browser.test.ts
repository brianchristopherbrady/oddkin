// Failure paths, exercised end to end in components: every failure has an owner and a code,
// unrelated work keeps running, and failed bindings recover when their inputs recover.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { define, OddkinElement, prop } from '../src/element/index.js';
import { computed, flush, signal } from '../src/reactive/index.js';
import { observerCount } from '../src/reactive/graph.js';
import { scopeStats } from '../src/scope/scope.js';
import type { Scope } from '../src/scope/index.js';
import { html } from '../src/template/index.js';

let reported: Array<ErrorContext & { error: unknown }>;
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;
const text = (el: Element) => el.shadowRoot?.textContent?.replace(/\s+/g, ' ').trim();
const codes = () => reported.map((r) => r.code);

beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ ...context, error }));
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  flush();
  setErrorHandler(undefined);
});

function mount<E extends HTMLElement>(name: string): E {
  const el = document.createElement(name) as E;
  container.append(el);
  return el;
}

describe('failure paths', () => {
  it('conversion: an invalid attribute reports, falls back to the default, and later values work', () => {
    class Sized extends OddkinElement.with({ size: prop.number({ default: 1 }) }) {
      protected override render() {
        return html`<p>${this.size}</p>`;
      }
    }
    const name = tag('fail-convert');
    define(name, Sized);
    const el = mount<Sized>(name);
    el.setAttribute('size', 'large');
    flush();
    expect(codes()).toEqual(['element.attribute.invalid']);
    expect([el.size, text(el)]).toEqual([1, '1']);
    el.setAttribute('size', '4');
    flush();
    expect([el.size, text(el)]).toEqual([4, '4']);
  });

  it('derivation in render: keeps the last good DOM, reports with the render as owner, and recovers', () => {
    const n = signal(1);
    const checked = computed(() => {
      if (n.value > 2) throw new Error('too big');
      return n.value * 10;
    });
    class Derived extends OddkinElement {
      protected override render() {
        return html`<p>${checked.value}</p>`;
      }
    }
    const name = tag('fail-derive');
    define(name, Derived);
    const el = mount<Derived>(name);
    expect(text(el)).toBe('10');
    n.value = 3;
    flush();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(reported[0]?.origin).toContain(`<${name}> render`);
    expect(text(el)).toBe('10');
    n.value = 2;
    flush();
    expect(text(el)).toBe('20');
  });

  it('derivation in a direct binding: other bindings in the template keep updating; it recovers', () => {
    const n = signal(1);
    const other = signal('a');
    const checked = computed(() => {
      if (n.value > 2) throw new Error('too big');
      return n.value;
    });
    class Direct extends OddkinElement {
      renders = 0;
      protected override render() {
        this.renders++;
        return html`<p>${checked}</p>
          <b>${other}</b>`;
      }
    }
    const name = tag('fail-direct');
    define(name, Direct);
    const el = mount<Direct>(name);
    n.value = 3;
    other.value = 'b';
    flush();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(text(el)).toBe('1 b');
    n.value = 2;
    flush();
    expect(text(el)).toBe('2 b');
    expect(el.renders).toBe(1);
  });

  it('effects: one failing effect does not stop the others in the same flush, and it re-runs later', () => {
    const trigger = signal(0);
    const seen: number[] = [];
    class Effects extends OddkinElement {
      protected override mounted(scope: Scope) {
        scope.effect(() => {
          if (trigger.value === 1) throw new Error('effect failed');
        });
        scope.effect(() => {
          seen.push(trigger.value);
        });
      }
    }
    const name = tag('fail-effect');
    define(name, Effects);
    mount(name);
    flush();
    trigger.value = 1;
    flush();
    trigger.value = 2;
    flush();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(seen).toEqual([0, 1, 2]);
  });

  it('commit: a throwing property setter is reported and sibling bindings still commit', () => {
    class Fragile extends HTMLElement {
      set value(v: number) {
        if (v > 1) throw new Error('setter rejected');
      }
    }
    const fragile = tag('fail-fragile');
    customElements.define(fragile, Fragile);
    const n = signal(1);
    class Committing extends OddkinElement {
      protected override render() {
        return html`<span>${n}</span>`;
      }
      protected override mounted(scope: Scope) {
        const child = document.createElement(fragile) as Fragile;
        (this.shadowRoot as ShadowRoot).append(child);
        scope.effect(() => {
          child.value = n.value;
        });
      }
    }
    const name = tag('fail-commit');
    define(name, Committing);
    const el = mount<Committing>(name);
    flush();
    n.value = 2;
    flush();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(text(el)).toBe('2');
    n.value = 1;
    flush();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(text(el)).toBe('1');
  });

  it('cleanup: every cleanup runs even if one throws, each failure reported once', () => {
    const ran: string[] = [];
    class Cleanups extends OddkinElement {
      protected override mounted(scope: Scope) {
        scope.add(() => ran.push('first'));
        scope.add(() => {
          throw new Error('cleanup failed');
        });
        scope.add(() => ran.push('third'));
      }
    }
    const name = tag('fail-cleanup');
    define(name, Cleanups);
    const el = mount(name);
    el.remove();
    expect(ran).toEqual(['third', 'first']);
    expect(codes()).toEqual(['scope.cleanup.error']);
  });

  it('hooks: a throwing mounted() is reported and the element still renders and updates', () => {
    class Hooked extends OddkinElement {
      readonly count = signal(0);
      protected override render() {
        return html`<p>${this.count}</p>`;
      }
      protected override mounted() {
        throw new Error('mounted failed');
      }
    }
    const name = tag('fail-hook');
    define(name, Hooked);
    const el = mount<Hooked>(name);
    el.count.value = 5;
    flush();
    expect(codes()).toEqual(['element.mounted.error']);
    expect(text(el)).toBe('5');
  });

  it('external signals: elements sharing a module-level signal unsubscribe when removed', () => {
    const shared = signal('x');
    class Reader extends OddkinElement {
      protected override render() {
        return html`<p>${shared}</p>`;
      }
    }
    const name = tag('fail-shared');
    define(name, Reader);
    const a = mount(name);
    const b = mount(name);
    expect(observerCount(shared)).toBe(2);
    a.remove();
    expect(observerCount(shared)).toBe(1);
    shared.value = 'y';
    flush();
    expect(text(b)).toBe('y');
    b.remove();
    expect(observerCount(shared)).toBe(0);
  });

  it('disposal during callbacks: a handler that removes its own host leaves no work behind', () => {
    const count = signal(0);
    const baseline = scopeStats();
    class SelfRemoving extends OddkinElement {
      readonly dismiss = (): void => {
        count.value++;
        this.parentNode?.removeChild(this);
        count.value++;
      };
      protected override render() {
        return html`<button type="button" @click=${this.dismiss}>${count}</button>`;
      }
    }
    const name = tag('fail-dispose');
    define(name, SelfRemoving);
    const el = mount(name);
    const button = el.shadowRoot?.querySelector('button') as HTMLButtonElement;
    button.click();
    flush();
    expect(codes()).toEqual([]);
    expect(observerCount(count)).toBe(0);
    expect(button.textContent).toBe('0');
    expect(scopeStats()).toEqual(baseline);
  });

  it('disposal during a flush: an effect that disposes another owner’s scope prevents its queued run', () => {
    const trigger = signal(0);
    const runs: string[] = [];
    class Owner extends OddkinElement {
      protected override mounted(scope: Scope) {
        scope.effect(() => {
          if (trigger.value) runs.push('owner');
        });
      }
    }
    const ownerName = tag('fail-owner');
    define(ownerName, Owner);
    class Remover extends OddkinElement {
      target: Element | undefined;
      protected override mounted(scope: Scope) {
        scope.effect(() => {
          if (trigger.value) this.target?.remove();
        });
      }
    }
    const removerName = tag('fail-remover');
    define(removerName, Remover);
    const remover = mount<Remover>(removerName);
    const owner = mount(ownerName);
    remover.target = owner;
    flush();
    trigger.value = 1;
    flush();
    expect(runs).toEqual([]);
    expect(codes()).toEqual([]);
  });

  it('reconnect: each connection gets a fresh scope; the old one is aborted; listeners do not accumulate', () => {
    const scopes: Scope[] = [];
    class Reconnecting extends OddkinElement {
      clicks = 0;
      protected override mounted(scope: Scope) {
        scopes.push(scope);
        scope.listen(document, 'click', () => this.clicks++);
      }
    }
    const name = tag('fail-reconnect');
    define(name, Reconnecting);
    const baseline = scopeStats();
    const el = mount<Reconnecting>(name);
    for (let i = 0; i < 5; i++) {
      el.remove();
      container.append(el);
    }
    expect(scopes).toHaveLength(6);
    expect(new Set(scopes).size).toBe(6);
    expect(scopes.slice(0, 5).every((s) => s.disposed && s.signal.aborted)).toBe(true);
    expect(scopes[5]?.disposed).toBe(false);
    document.dispatchEvent(new Event('click'));
    expect(el.clicks).toBe(1);
    el.remove();
    expect(scopeStats()).toEqual(baseline);
  });

  it('direct binding updates neither re-render the host nor read layout', () => {
    const count = signal(0);
    class Plain extends OddkinElement {
      renders = 0;
      protected override render() {
        this.renders++;
        return html`<p title=${count}>${count}</p>
          <input .value=${count} />`;
      }
    }
    const name = tag('fail-layout');
    define(name, Plain);
    const el = mount<Plain>(name);
    let layoutReads = 0;
    const restore: Array<() => void> = [];
    const spy = (target: object, key: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, key) as PropertyDescriptor;
      const patched: PropertyDescriptor = descriptor.get
        ? {
            ...descriptor,
            get() {
              layoutReads++;
              return descriptor.get?.call(this);
            },
          }
        : {
            ...descriptor,
            value(this: unknown, ...args: unknown[]) {
              layoutReads++;
              return (descriptor.value as (...a: unknown[]) => unknown).apply(this, args);
            },
          };
      Object.defineProperty(target, key, patched);
      restore.push(() => Object.defineProperty(target, key, descriptor));
    };
    for (const key of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft']) {
      spy(HTMLElement.prototype, key);
    }
    for (const key of ['clientWidth', 'clientHeight', 'scrollTop', 'scrollHeight']) {
      spy(Element.prototype, key);
    }
    spy(Element.prototype, 'getBoundingClientRect');
    spy(Element.prototype, 'getClientRects');
    spy(window, 'getComputedStyle');
    try {
      for (let i = 1; i <= 3; i++) {
        count.value = i;
        flush();
      }
    } finally {
      for (const undo of restore.reverse()) undo();
    }
    expect(layoutReads).toBe(0);
    expect(el.renders).toBe(1);
    expect(text(el)).toBe('3');
    expect(el.shadowRoot?.querySelector('p')?.title).toBe('3');
  });
});

describe('production diagnostics in the browser', () => {
  it('keeps codes and owners with short messages', async () => {
    const url = new URL('../dist/prod/index.js', import.meta.url).href;
    const prod = (await import(/* @vite-ignore */ url)) as typeof import('../src/index.js');
    const seen: Array<{ code: string; message: string; origin: string | undefined }> = [];
    const previous = prod.setErrorHandler((error, context) =>
      seen.push({
        code: context.code,
        origin: context.origin,
        message: (error as Error).message,
      }),
    );
    try {
      const n = prod.signal(1);
      class ProdDerived extends prod.OddkinElement {
        protected override render() {
          if (n.value > 1) throw new prod.OddkinError('demo.render.failed', '');
          return prod.html`<p>${n}</p>`;
        }
      }
      const name = tag('fail-prod');
      prod.define(name, ProdDerived);
      const el = mount(name);
      el.setAttribute('ignored', '');
      n.value = 2;
      prod.flush();
      expect(seen).toEqual([
        {
          code: 'reactive.effect.error',
          origin: `<${name}> render`,
          message:
            '[demo.render.failed] Use the development build (the "development" export condition) for details.',
        },
      ]);
      n.value = 1;
      prod.flush();
      expect(text(el)).toBe('1');
    } finally {
      prod.setErrorHandler(previous);
    }
  });
});
