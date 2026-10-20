// Context (core-contracts.md §7.2): nearest provider in the composed tree, nested overrides,
// independent roots, Shadow DOM, reparenting, provider replacement, late providers, and the
// community context protocol in both directions.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '@oddkin/core/diagnostics';
import { OddkinElement, define } from '@oddkin/core/element';
import { computed, flush, signal } from '@oddkin/core/reactive';
import { createScope, scopeStats, type Scope } from '@oddkin/core/scope';
import { html } from '@oddkin/core/template';
import {
  ContextRequestEvent,
  consume,
  createContext,
  provide,
  type ContextCallback,
} from '../src/context/index.js';

interface Theme {
  readonly name: string;
  readonly dense: boolean;
}
const themeContext = createContext<Theme>('theme');
const light: Theme = { name: 'light', dense: false };
const dark: Theme = { name: 'dark', dense: false };
const fallback: Theme = { name: 'fallback', dense: false };

/** Provides `theme` (a signal) to everything below it. */
class ThemeRegion extends OddkinElement {
  readonly theme = signal<Theme>(light);
  readonly provider = provide(this, themeContext, this.theme);
  protected override connected(scope: Scope) {
    scope.use(this.provider);
  }
}
define('ctx-theme-region', ThemeRegion);

/** Reads the nearest theme: the name is bound directly, `dense` is read during render. */
class ThemedLabel extends OddkinElement {
  renders = 0;
  readonly theme = consume(this, themeContext, { fallback });
  readonly themeName = computed(() => this.theme.value.name);
  readonly dense = computed(() => this.theme.value.dense);
  protected override connected(scope: Scope) {
    scope.use(this.theme);
  }
  protected override moved() {
    this.theme.resolve();
  }
  protected override render() {
    this.renders++;
    return html`<span class="name">${this.themeName}</span
      ><span class="density">${this.dense.value ? 'dense' : 'regular'}</span>`;
  }
}
define('ctx-themed-label', ThemedLabel);

/** Requires a provider. */
class RequiredLabel extends OddkinElement {
  readonly theme = consume(this, themeContext, { required: true });
  protected override connected(scope: Scope) {
    scope.use(this.theme);
  }
}
define('ctx-required-label', RequiredLabel);

/** Consumes the enclosing theme and provides a dense variant of it to its children. */
class DenseRegion extends OddkinElement {
  readonly parent = consume(this, themeContext, { fallback });
  readonly provider = provide(
    this,
    themeContext,
    computed(() => ({ ...this.parent.value, dense: true })),
  );
  protected override connected(scope: Scope) {
    scope.use(this.provider);
    scope.use(this.parent);
  }
}
define('ctx-dense-region', DenseRegion);

/** Provides from its shadow root to slotted children: `<section><slot></slot></section>`. */
class ShadowRegion extends OddkinElement {
  protected override render() {
    return html`<section><slot></slot></section>`;
  }
  protected override mounted(scope: Scope) {
    scope.use(provide(this.shadowRoot!, themeContext, dark));
  }
}
define('ctx-shadow-region', ShadowRegion);

/** Renders a themed label inside its own shadow root. */
class LabelCard extends OddkinElement {
  protected override render() {
    return html`<ctx-themed-label></ctx-themed-label>`;
  }
  get label(): ThemedLabel {
    return this.shadowRoot!.querySelector('ctx-themed-label') as ThemedLabel;
  }
}
define('ctx-label-card', LabelCard);

let container: HTMLElement;
let reported: { error: unknown; context: ErrorContext }[];
beforeEach(() => {
  reported = [];
  setErrorHandler((error, context) => reported.push({ error, context }));
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  flush();
  setErrorHandler(undefined);
});

const create = <E extends HTMLElement>(tag: string, ...children: Node[]): E => {
  const element = document.createElement(tag) as E;
  element.append(...children);
  return element;
};
const label = () => create<ThemedLabel>('ctx-themed-label');
const region = (...children: Node[]) => create<ThemeRegion>('ctx-theme-region', ...children);
const nameOf = (el: ThemedLabel) => el.shadowRoot!.querySelector('.name')!.textContent;
const densityOf = (el: ThemedLabel) => el.shadowRoot!.querySelector('.density')!.textContent;
const settle = async () => {
  flush();
  await Promise.resolve();
  flush();
};

describe('context', () => {
  it('resolves to the nearest provider; nested providers override for their subtree', async () => {
    const a = label();
    const b = label();
    const inner = region(b);
    const outer = region(a, inner);
    container.append(outer);
    inner.theme.value = dark;
    await settle();
    expect([nameOf(a), nameOf(b)]).toEqual(['light', 'dark']);
    expect([a.theme.provided, b.theme.provided]).toEqual([true, true]);
    expect([outer.provider.consumers, inner.provider.consumers]).toEqual([1, 1]);

    outer.theme.value = { name: 'contrast', dense: false };
    await settle();
    expect([nameOf(a), nameOf(b)]).toEqual(['contrast', 'dark']);
  });

  it('updates a directly bound value without re-rendering and re-renders for a render-tracked one', async () => {
    const a = label();
    const outer = region(a);
    container.append(outer);
    await settle();
    expect(a.renders).toBe(1);
    const node = a.shadowRoot!.querySelector('.name');
    outer.theme.value = dark;
    await settle();
    expect(nameOf(a)).toBe('dark');
    expect(a.renders).toBe(1);
    expect(a.shadowRoot!.querySelector('.name')).toBe(node);
    outer.provider.value = { name: 'dark', dense: true }; // a plain value replaces the signal
    await settle();
    expect(densityOf(a)).toBe('dense');
    expect(a.renders).toBe(2);
    outer.provider.value = outer.theme; // and a readable is followed again
    await settle();
    expect([nameOf(a), densityOf(a)]).toEqual(['dark', 'regular']);
  });

  it('uses the fallback without a provider, reports a required one, and finds a later provider', async () => {
    const lone = label();
    const required = create<RequiredLabel>('ctx-required-label');
    container.append(lone, required);
    await settle();
    expect(nameOf(lone)).toBe('fallback');
    expect(lone.theme.provided).toBe(false);
    expect(required.theme.value).toBeUndefined();
    expect(reported.map((r) => [r.context.code, r.context.origin])).toEqual([
      ['state.context.missing', 'ctx-required-label'],
    ]);
    expect((reported[0]!.error as Error).message).toContain('requires context "theme"');

    // A provider whose element is defined only after the consumer connected.
    const waiting = label();
    const late = create('ctx-late-region', waiting);
    container.append(late);
    await settle();
    expect(nameOf(waiting)).toBe('fallback');
    class LateRegion extends ThemeRegion {}
    define('ctx-late-region', LateRegion);
    await settle();
    expect(nameOf(waiting)).toBe('light');
    expect(waiting.theme.provided).toBe(true);
    expect(nameOf(lone)).toBe('fallback'); // not below the new provider
  });

  it('keeps independent roots apart', async () => {
    const a = label();
    const b = label();
    const outside = label();
    const first = region(a);
    const second = region(b);
    container.append(first, second, outside);
    second.theme.value = dark;
    await settle();
    expect([nameOf(a), nameOf(b), nameOf(outside)]).toEqual(['light', 'dark', 'fallback']);
    first.theme.value = { name: 'first', dense: false };
    await settle();
    expect([nameOf(a), nameOf(b)]).toEqual(['first', 'dark']);
  });

  it('crosses shadow roots: consumers inside shadow trees, providers to slotted children', async () => {
    const card = create<LabelCard>('ctx-label-card');
    const slotted = label();
    const beside = label();
    const shadow = create('ctx-shadow-region', slotted);
    container.append(region(card, shadow, beside));
    await settle();
    expect(nameOf(card.label)).toBe('light'); // inside a shadow root, provider in the light tree
    expect(nameOf(slotted)).toBe('dark'); // slotted, provider inside the host's shadow root
    expect(nameOf(beside)).toBe('light');
  });

  it('follows a consumer moved to another provider and releases the previous one', async () => {
    const moving = label();
    const first = region(moving);
    const second = region();
    second.theme.value = dark;
    container.append(first, second);
    await settle();
    expect(nameOf(moving)).toBe('light');
    second.append(moving);
    await settle();
    expect(nameOf(moving)).toBe('dark');
    expect([first.provider.consumers, second.provider.consumers]).toEqual([0, 1]);
  });

  it.skipIf(!('moveBefore' in Element.prototype))(
    'keeps the connection through a state-preserving move; resolve() re-resolves',
    async () => {
      const moving = label();
      const first = region(moving);
      const second = region();
      second.theme.value = dark;
      container.append(first, second);
      await settle();
      const renders = moving.renders;
      (second as unknown as { moveBefore(node: Node, child: Node | null): void }).moveBefore(
        moving,
        null,
      );
      await settle();
      expect(nameOf(moving)).toBe('dark'); // moved() called resolve()
      expect(moving.renders).toBe(renders); // same connection: no new render effect
      expect([first.provider.consumers, second.provider.consumers]).toEqual([0, 1]);
      // Moved where no provider is: resolve() leaves the previous one.
      (container as unknown as { moveBefore(node: Node, child: Node | null): void }).moveBefore(
        moving,
        null,
      );
      await settle();
      expect(nameOf(moving)).toBe('fallback');
      expect(moving.theme.provided).toBe(false);
      expect([first.provider.consumers, second.provider.consumers]).toEqual([0, 0]);
    },
  );

  it('hands consumers to the next provider up when a provider stops, and back to a new one', async () => {
    const a = label();
    const wrapper = create('div', a);
    const outer = region(wrapper);
    container.append(outer);
    await settle();
    expect(nameOf(a)).toBe('light');

    const scope = createScope({ name: 'override' });
    const override = scope.use(provide(wrapper, themeContext, dark));
    await settle();
    expect(nameOf(a)).toBe('dark'); // the enclosing provider handed it over
    expect([outer.provider.consumers, override.consumers]).toEqual([0, 1]);

    scope.dispose();
    await settle();
    expect(nameOf(a)).toBe('light');
    expect(outer.provider.consumers).toBe(1);

    const again = createScope({ name: 'replacement' });
    again.use(provide(wrapper, themeContext, { name: 'replacement', dense: false }));
    await settle();
    expect(nameOf(a)).toBe('replacement');
    again.dispose();
    await settle();
    expect(nameOf(a)).toBe('light');
  });

  it('waits for a replacement when the only provider stops', async () => {
    const a = label();
    const host = create('div', a);
    container.append(host);
    const first = createScope();
    first.use(provide(host, themeContext, dark));
    await settle();
    expect(nameOf(a)).toBe('dark');
    first.dispose();
    await settle();
    expect(nameOf(a)).toBe('fallback');
    expect(a.theme.provided).toBe(false);
    const second = createScope();
    second.use(provide(host, themeContext, light));
    await settle();
    expect(nameOf(a)).toBe('light');
    second.dispose();
  });

  it('gives an element that consumes and provides the same context its parent value', async () => {
    const inside = label();
    const dense = create<DenseRegion>('ctx-dense-region', inside);
    const outer = region(dense);
    container.append(outer);
    await settle();
    expect(dense.parent.value).toEqual(light);
    expect([nameOf(inside), densityOf(inside)]).toEqual(['light', 'dense']);
    outer.theme.value = dark;
    await settle();
    expect([nameOf(inside), densityOf(inside)]).toEqual(['dark', 'dense']);
  });

  it('answers plain protocol requests and unsubscribes them', async () => {
    const outer = region();
    const target = document.createElement('div');
    outer.append(target);
    container.append(outer);
    const values: Theme[] = [];
    let unsubscribe: (() => void) | undefined;
    target.dispatchEvent(
      new ContextRequestEvent(
        themeContext,
        target,
        (value, off) => {
          values.push(value);
          unsubscribe = off;
        },
        true,
      ),
    );
    expect(values).toEqual([light]);
    expect(outer.provider.consumers).toBe(1);
    outer.theme.value = dark;
    expect(values).toEqual([light, dark]);
    unsubscribe!();
    expect(outer.provider.consumers).toBe(0);
    outer.theme.value = light;
    expect(values).toHaveLength(2);

    // A one-shot request gets one value, no unsubscribe, and is not retained.
    const once: unknown[][] = [];
    target.dispatchEvent(
      new ContextRequestEvent(themeContext, target, (...args) => once.push(args)),
    );
    expect(once).toEqual([[light]]);
    expect(outer.provider.consumers).toBe(0);

    // A throwing callback is reported and does not stop others.
    const seen: string[] = [];
    target.dispatchEvent(
      new ContextRequestEvent(
        themeContext,
        target,
        (value) => {
          if (value.name === 'dark') throw new Error('consumer failed');
        },
        true,
      ),
    );
    target.dispatchEvent(
      new ContextRequestEvent(themeContext, target, (value) => seen.push(value.name), true),
    );
    outer.theme.value = dark;
    expect(seen).toEqual(['light', 'dark']);
    expect(reported.map((r) => r.context.code)).toEqual(['state.context.callback']);
  });

  it('receives values from a provider written against the protocol only', async () => {
    let current: Theme = light;
    const subscriptions = new Map<ContextCallback<Theme>, () => void>();
    const host = document.createElement('div');
    host.addEventListener('context-request', (event) => {
      const request = event as ContextRequestEvent<Theme>;
      if (request.context !== themeContext) return;
      event.stopImmediatePropagation();
      const callback = request.callback;
      if (!request.subscribe) return callback(current);
      const off = () => void subscriptions.delete(callback);
      subscriptions.set(callback, off);
      callback(current, off);
    });
    const a = label();
    host.append(a);
    container.append(host);
    await settle();
    expect(nameOf(a)).toBe('light');
    expect(a.theme.provided).toBe(true);
    expect(subscriptions.size).toBe(1);
    current = dark;
    for (const [callback, off] of subscriptions) callback(current, off);
    await settle();
    expect(nameOf(a)).toBe('dark');
    a.remove();
    expect(subscriptions.size).toBe(0);
  });

  it('returns ownership to baseline when providers and consumers disconnect', async () => {
    const baseline = scopeStats();
    const a = label();
    const b = label();
    const card = create<LabelCard>('ctx-label-card');
    const outer = region(a, region(b), card, create('ctx-dense-region', label()));
    container.append(outer);
    await settle();
    expect(scopeStats()).not.toEqual(baseline);
    outer.remove();
    await settle();
    expect(scopeStats()).toEqual(baseline);
    expect(outer.provider.consumers).toBe(0);
    expect([a.theme.provided, b.theme.provided]).toEqual([false, false]);
    container.append(outer); // reconnecting resolves again
    await settle();
    expect([nameOf(a), nameOf(b)]).toEqual(['light', 'light']);
    expect(reported).toEqual([]);
  });
});
