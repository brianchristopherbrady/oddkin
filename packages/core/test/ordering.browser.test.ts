import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { define, OddkinElement, prop } from '../src/element/index.js';
import { batch, computed, flush, signal } from '../src/reactive/index.js';
import type { Scope } from '../src/scope/index.js';
import { html } from '../src/template/index.js';

// Ordering examples (core-contracts.md §6.1, "Ordering"): what runs, in which order, for property
// writes, attributes, batch, computed values, DOM commits, effects, updated, and updateComplete.
let reported: ErrorContext[];
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;
let log: string[];

beforeEach(() => {
  reported = [];
  log = [];
  setErrorHandler((_error, context) => reported.push(context));
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
  setErrorHandler(undefined);
});

class Ordered extends OddkinElement.with({ label: prop.string({ default: 'a' }) }) {
  readonly count = signal(0);
  readonly doubled = computed(() => {
    log.push(`computed:${this.count.value}`);
    return this.count.value * 2;
  });
  protected override connected(scope: Scope) {
    log.push('connected');
    scope.effect(() => {
      log.push(`effect:${this.count.value}`);
    });
  }
  protected override mounted() {
    log.push(`mounted:${this.shadowRoot!.textContent}`);
  }
  protected override render() {
    log.push(`render:${this.label}`);
    return html`<p>${this.label}:${this.doubled}</p>`;
  }
  protected override updated(changes: ReadonlyMap<string, unknown>) {
    log.push(`updated:${[...changes.keys()].join(',')}:${this.shadowRoot!.textContent}`);
  }
  protected override disconnected() {
    log.push('disconnected');
  }
}
const orderedTag = tag('demo-ordered');
define(orderedTag, Ordered);
const mount = () => {
  const el = document.createElement(orderedTag) as Ordered;
  container.append(el);
  return el;
};

describe('ordering', () => {
  it('first connection', async () => {
    const el = mount();
    log.push('appended');
    await el.updateComplete;
    log.push('updateComplete');
    expect(log).toEqual([
      'connected',
      'effect:0',
      'render:a',
      'computed:0',
      'mounted:a:0',
      'appended',
      'updated::a:0',
      'updateComplete',
    ]);
  });

  it('property writes, attributes, batch, and computed values before and after the flush', async () => {
    const el = mount();
    await el.updateComplete;
    log.length = 0;
    el.label = 'b';
    log.push(`property read:${el.label}`);
    el.setAttribute('label', 'c');
    log.push(`attribute read:${el.label}`);
    batch(() => {
      el.count.value = 1;
      el.count.value = 2;
      log.push(`in batch doubled:${el.doubled.value}`);
    });
    log.push(`dom before flush:${el.shadowRoot!.textContent}`);
    await el.updateComplete;
    log.push(`updateComplete:${el.shadowRoot!.textContent}`);
    expect(log).toEqual([
      'property read:b',
      'attribute read:c',
      'computed:2',
      'in batch doubled:4',
      'dom before flush:a:0',
      'render:c',
      'updated:label:c:4',
      'effect:2',
      'updateComplete:c:4',
    ]);
  });

  it('a write in updated() schedules one more pass in the same flush', async () => {
    class Echo extends Ordered {
      protected override updated(changes: ReadonlyMap<string, unknown>) {
        super.updated(changes);
        if (this.label === 'x') this.label = 'y';
      }
    }
    const name = tag('demo-echo');
    define(name, Echo);
    const el = document.createElement(name) as Echo;
    container.append(el);
    await el.updateComplete;
    log.length = 0;
    el.label = 'x';
    await el.updateComplete;
    log.push(`updateComplete:${el.shadowRoot!.textContent}`);
    expect(log).toEqual([
      'render:x',
      'updated:label:x:0',
      'render:y',
      'updated:label:y:0',
      'updateComplete:y:0',
    ]);
  });

  it('writes while detached, then reconnection', async () => {
    const el = mount();
    await el.updateComplete;
    el.remove();
    log.length = 0;
    el.label = 'd';
    el.count.value = 5;
    await el.updateComplete;
    log.push(`detached updateComplete:${el.shadowRoot!.textContent}`);
    container.append(el);
    log.push(`reconnected:${el.shadowRoot!.textContent}`);
    await el.updateComplete;
    log.push(`updateComplete:${el.shadowRoot!.textContent}`);
    expect(log).toEqual([
      'detached updateComplete:a:0',
      'connected',
      'effect:5',
      'render:d',
      'computed:5',
      'mounted:d:10',
      'reconnected:d:10',
      'updated:label:d:10',
      'updateComplete:d:10',
    ]);
  });

  it('a render error keeps the last DOM; the next good value renders; updated still runs', async () => {
    class Fragile extends Ordered {
      protected override render() {
        if (this.label === 'boom') throw new Error('boom');
        return super.render();
      }
    }
    const name = tag('demo-fragile');
    define(name, Fragile);
    const el = document.createElement(name) as Fragile;
    container.append(el);
    await el.updateComplete;
    log.length = 0;
    el.label = 'boom';
    await el.updateComplete;
    log.push(`after error:${el.shadowRoot!.textContent}:${reported.map((r) => r.code).join(',')}`);
    el.label = 'ok';
    await el.updateComplete;
    log.push(`recovered:${el.shadowRoot!.textContent}`);
    expect(log).toEqual([
      'updated:label:a:0',
      'after error:a:0:reactive.effect.error',
      'render:ok',
      'updated:label:ok:0',
      'recovered:ok:0',
    ]);
  });

  it('updateComplete does not wait for child elements', async () => {
    const parentTag = tag('demo-parent');
    const childTag = tag('demo-child');
    class Parent extends OddkinElement {
      protected override render() {
        return html`<slot></slot>`;
      }
    }
    define(parentTag, Parent);
    const parent = document.createElement(parentTag) as Parent;
    const child = document.createElement(childTag);
    parent.append(child);
    container.append(parent);
    await parent.updateComplete;
    log.push(`child defined:${customElements.get(childTag) !== undefined}`);
    class Child extends OddkinElement {
      protected override render() {
        log.push('child render');
        return html`child`;
      }
    }
    define(childTag, Child);
    log.push('after define');
    expect(log).toEqual(['child defined:false', 'child render', 'after define']);
  });
});
