import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { define, event, MoteElement, prop } from '../src/element/index.js';
import { flush, signal } from '../src/reactive/index.js';
import { scopeStats } from '../src/scope/scope.js';
import type { Scope } from '../src/scope/index.js';
import { adoptStyles, css, unsafeCSS } from '../src/styles/index.js';
import { html } from '../src/template/index.js';

let reported: ErrorContext[];
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;

beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
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

const shadowText = (el: Element) => el.shadowRoot?.textContent?.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------

class DemoCounter extends MoteElement {
  readonly count = signal(0);
  renders = 0;
  readonly increment = () => this.count.update((value) => value + 1);

  protected override render() {
    this.renders++;
    return html`<button type="button" @click=${this.increment}>Count: ${this.count}</button>`;
  }
}
const counterTag = tag('demo-counter');
define(counterTag, DemoCounter);

class DemoGreeting extends MoteElement.with({
  name: prop.string({ default: 'world' }),
  quiet: prop.boolean({ reflect: true }),
  size: prop.number({ default: 1 }),
  tone: prop.enum(['calm', 'loud'], { default: 'calm', reflect: true }),
  items: prop.array<string>(),
  config: prop.object<{ step: number }>({ default: () => ({ step: 1 }) }),
}) {
  renders = 0;
  protected override render() {
    this.renders++;
    return html`<p>${this.quiet ? 'Hello' : 'Hello!'} ${this.name}</p>`;
  }
}
const greetingTag = tag('demo-greeting');
define(greetingTag, DemoGreeting);

describe('binding rule in components', () => {
  it('updates a direct readable binding without re-running render()', () => {
    const el = mount<DemoCounter>(counterTag);
    const button = el.shadowRoot?.querySelector('button') as HTMLButtonElement;
    button.click();
    button.click();
    flush();
    expect(shadowText(el)).toBe('Count: 2');
    expect(el.renders).toBe(1);
    expect(el.shadowRoot?.querySelector('button')).toBe(button);
  });

  it('re-runs render() once for tracked .value reads, however many writes', () => {
    class Tracked extends MoteElement {
      readonly count = signal(0);
      renders = 0;
      protected override render() {
        this.renders++;
        return html`<span>${this.count.value}</span>`;
      }
    }
    const name = tag('demo-tracked');
    define(name, Tracked);
    const el = mount<Tracked>(name);
    el.count.value = 1;
    el.count.value = 2;
    el.count.value = 3;
    flush();
    expect([el.renders, shadowText(el)]).toEqual([2, '3']);
  });

  it('coalesces a value reached by both render and a direct binding into one DOM write', async () => {
    class Dual extends MoteElement {
      readonly count = signal(0);
      protected override render() {
        return html`<span>${this.count.value > 10 ? 'big' : 'small'}</span><b>${this.count}</b>`;
      }
    }
    const name = tag('demo-dual');
    define(name, Dual);
    const el = mount<Dual>(name);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(el.shadowRoot as ShadowRoot, {
      subtree: true,
      characterData: true,
      childList: true,
    });
    el.count.value = 1;
    flush();
    await Promise.resolve();
    observer.disconnect();
    expect(records.length).toBe(1);
    expect(shadowText(el)).toBe('small1');
  });

  it('does not track reads in event handlers', () => {
    class Handler extends MoteElement {
      readonly count = signal(0);
      renders = 0;
      readonly read = () => {
        void this.count.value;
      };
      protected override render() {
        this.renders++;
        return html`<button @click=${this.read}>x</button>`;
      }
    }
    const name = tag('demo-handler');
    define(name, Handler);
    const el = mount<Handler>(name);
    (el.shadowRoot?.querySelector('button') as HTMLButtonElement).click();
    el.count.value = 5;
    flush();
    expect(el.renders).toBe(1);
  });
});

describe('public properties', () => {
  it('installs typed accessors with defaults', () => {
    const el = mount<DemoGreeting>(greetingTag);
    expect([el.name, el.quiet, el.size, el.tone, el.items, el.config]).toEqual([
      'world',
      false,
      1,
      'calm',
      [],
      { step: 1 },
    ]);
    expect(shadowText(el)).toBe('Hello! world');
    el.name = 'Ada';
    flush();
    expect(shadowText(el)).toBe('Hello! Ada');
  });

  it('never shares object or array defaults between instances', () => {
    const a = mount<DemoGreeting>(greetingTag);
    const b = mount<DemoGreeting>(greetingTag);
    expect(a.config).not.toBe(b.config);
    expect(a.items).not.toBe(b.items);
  });

  it('converts attributes, with presence semantics for booleans', () => {
    const el = mount<DemoGreeting>(greetingTag);
    el.setAttribute('name', 'Grace');
    el.setAttribute('size', '3.5');
    el.setAttribute('quiet', '');
    el.setAttribute('tone', 'loud');
    expect([el.name, el.size, el.quiet, el.tone]).toEqual(['Grace', 3.5, true, 'loud']);
    el.setAttribute('quiet', 'false');
    expect(el.quiet).toBe(true);
    el.removeAttribute('quiet');
    el.removeAttribute('name');
    expect([el.quiet, el.name]).toEqual([false, 'world']);
  });

  it('reports invalid attributes and properties and falls back to the default', () => {
    const el = mount<DemoGreeting>(greetingTag);
    el.setAttribute('size', 'big');
    el.setAttribute('tone', 'shouty');
    (el as unknown as { size: unknown }).size = 'nope';
    expect([el.size, el.tone]).toEqual([1, 'calm']);
    expect(reported.map((r) => r.code)).toEqual([
      'element.attribute.invalid',
      'element.attribute.invalid',
      'element.prop.invalid',
    ]);
  });

  it('reflects only opted-in properties, on commit', () => {
    const el = mount<DemoGreeting>(greetingTag);
    expect(el.getAttribute('tone')).toBe('calm');
    el.quiet = true;
    el.tone = 'loud';
    el.name = 'Lin';
    expect(el.hasAttribute('quiet')).toBe(false);
    flush();
    expect([el.hasAttribute('quiet'), el.getAttribute('tone'), el.hasAttribute('name')]).toEqual([
      true,
      'loud',
      false,
    ]);
    el.quiet = false;
    flush();
    expect(el.hasAttribute('quiet')).toBe(false);
  });

  it('replays properties set before upgrade', () => {
    const name = tag('demo-late');
    const el = document.createElement(name) as HTMLElement & { label?: string };
    el.label = 'early';
    container.append(el);
    class Late extends MoteElement.with({ label: prop.string({ default: 'default' }) }) {
      protected override render() {
        return html`${this.label}`;
      }
    }
    define(name, Late);
    expect(el.label).toBe('early');
    expect(Object.hasOwn(el, 'label')).toBe(false);
    expect(shadowText(el)).toBe('early');
  });

  it('rejects reserved and duplicate names', () => {
    const codeOf = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as { code?: string }).code;
      }
      return undefined;
    };
    expect(codeOf(() => MoteElement.with({ title: prop.string() }))).toBe('element.prop.reserved');
    expect(codeOf(() => MoteElement.with({ render: prop.string() }))).toBe('element.prop.reserved');
    expect(codeOf(() => DemoGreeting.with({ name: prop.string() }))).toBe('element.prop.duplicate');
    expect(codeOf(() => MoteElement.with({ label: prop.string({ attribute: 'id' }) }))).toBe(
      'element.attribute.reserved',
    );
    expect(
      codeOf(() =>
        MoteElement.with({
          a: prop.string({ attribute: 'x' }),
          b: prop.string({ attribute: 'x' }),
        }),
      ),
    ).toBe('element.attribute.duplicate');
  });

  it('rejects class fields that shadow reactive properties', () => {
    class Shadowing extends MoteElement.with({ label: prop.string({ default: 'a' }) }) {
      // @ts-expect-error -- deliberately redeclared to test the runtime diagnostic
      label = 'field';
      protected override render() {
        return html`${this.label}`;
      }
    }
    const name = tag('demo-shadowing');
    define(name, Shadowing);
    const el = mount<Shadowing>(name);
    expect(reported.map((r) => r.code)).toContain('element.prop.shadowed');
    expect(Object.hasOwn(el, 'label')).toBe(false);
    expect(shadowText(el)).toBe('field');
  });

  it('supports subclassing with additional properties', () => {
    class Loud extends DemoGreeting.with({ volume: prop.number({ default: 11 }) }) {
      protected override render() {
        return html`${this.name}:${this.volume}`;
      }
    }
    const name = tag('demo-loud');
    define(name, Loud);
    const el = mount<Loud>(name);
    el.setAttribute('volume', '5');
    flush();
    expect(shadowText(el)).toBe('world:5');
    expect((Loud as unknown as { observedAttributes: string[] }).observedAttributes).toEqual([
      'name',
      'quiet',
      'size',
      'tone',
      'volume',
    ]);
  });
});

describe('lifecycle', () => {
  class Life extends MoteElement.with({ label: prop.string({ default: 'x' }) }) {
    log: string[] = [];
    readonly local = signal(0);
    protected override connected(scope: Scope) {
      this.log.push('connected');
      scope.listen(window, 'life-ping', () => this.log.push('ping'));
    }
    protected override mounted() {
      this.log.push(`mounted:${this.shadowRoot?.textContent ?? ''}`);
    }
    protected override updated(changes: ReadonlyMap<string, unknown>) {
      this.log.push(`updated:${[...changes.keys()].join(',')}`);
    }
    protected override disconnected() {
      this.log.push('disconnected');
    }
    protected override render() {
      return html`<i>${this.local}</i>`;
    }
  }
  const lifeTag = tag('demo-life');
  define(lifeTag, Life);

  it('orders hooks and runs updated once per commit batch', async () => {
    const el = mount<Life>(lifeTag);
    await el.updateComplete;
    el.label = 'a';
    el.label = 'b';
    el.local.value = 1;
    await el.updateComplete;
    expect(el.log).toEqual(['connected', 'mounted:0', 'updated:', 'updated:label']);
  });

  it('disposes connection work on disconnect and resumes retained DOM on reconnect', () => {
    const el = mount<Life>(lifeTag);
    const node = el.shadowRoot?.querySelector('i');
    el.remove();
    window.dispatchEvent(new Event('life-ping'));
    el.local.value = 7;
    flush();
    expect(el.shadowRoot?.querySelector('i')?.textContent).toBe('0');
    container.append(el);
    window.dispatchEvent(new Event('life-ping'));
    expect(el.shadowRoot?.querySelector('i')).toBe(node);
    expect(node?.textContent).toBe('7');
    expect(el.log.filter((x) => x === 'ping').length).toBe(1);
    expect(el.log.filter((x) => x === 'connected').length).toBe(2);
    expect(el.log).toContain('disconnected');
    el.remove();
  });

  it('returns owned resources to baseline after 1,000 connect/disconnect cycles', () => {
    const el = mount<Life>(lifeTag);
    el.remove();
    flush();
    const baseline = scopeStats();
    for (let i = 0; i < 1000; i++) {
      container.append(el);
      el.local.value = i;
      el.remove();
    }
    flush();
    expect(scopeStats()).toEqual(baseline);
  });

  it('lets async work detect a stale connection by signal or generation', async () => {
    class Loader extends MoteElement {
      readonly log: string[] = [];
      protected override connected(scope: Scope) {
        const generation = this.connectionGeneration;
        const { signal: abort } = scope;
        void Promise.resolve().then(() => {
          const current = generation === this.connectionGeneration && !abort.aborted;
          this.log.push(`${current ? 'commit' : 'discard'} ${generation}`);
        });
      }
    }
    const name = tag('demo-loader');
    define(name, Loader);
    const el = mount<Loader>(name);
    el.remove();
    container.append(el);
    await Promise.resolve();
    await Promise.resolve();
    expect(el.log).toEqual(['discard 1', 'commit 2']);
  });

  it('keeps the connection across moveBefore where supported', () => {
    const el = mount<Life>(lifeTag);
    const target = document.createElement('section');
    container.append(target);
    const parent = target as unknown as { moveBefore?: (node: Node, ref: Node | null) => void };
    if (typeof parent.moveBefore !== 'function') return;
    parent.moveBefore(el, null);
    expect(el.parentNode).toBe(target);
    expect(el.log.filter((x) => x === 'connected').length).toBe(1);
  });

  it('isolates hook and render errors and keeps the previous DOM', () => {
    class Broken extends MoteElement {
      readonly fail = signal(false);
      protected override connected() {
        throw new Error('connect failed');
      }
      protected override render() {
        if (this.fail.value) throw new Error('render failed');
        return html`<b>ok</b>`;
      }
    }
    const name = tag('demo-broken');
    define(name, Broken);
    const el = mount<Broken>(name);
    el.fail.value = true;
    flush();
    expect(shadowText(el)).toBe('ok');
    expect(reported.map((r) => r.code)).toEqual([
      'element.connected.error',
      'reactive.effect.error',
    ]);
    el.fail.value = false;
    flush();
    expect(shadowText(el)).toBe('ok');
  });
});

describe('styles', () => {
  const shared = css`
    :host {
      display: block;
      padding: ${4}px;
    }
  `;

  it('shares one constructed sheet across 100 instances', () => {
    class Styled extends MoteElement {
      static override styles = shared;
      protected override render() {
        return html`<slot></slot>`;
      }
    }
    const name = tag('demo-styled');
    define(name, Styled);
    const sheets = new Set<CSSStyleSheet>();
    for (let i = 0; i < 100; i++) {
      const el = mount<Styled>(name);
      for (const sheet of el.shadowRoot?.adoptedStyleSheets ?? []) sheets.add(sheet);
    }
    expect(sheets.size).toBe(1);
    const el = container.querySelector(name) as HTMLElement;
    expect(getComputedStyle(el).paddingTop).toBe('4px');
  });

  it('rejects untrusted string interpolation', () => {
    expect(
      () => css`
        a {
          color: ${'red' as never};
        }
      `,
    ).toThrowError(/style.interpolation|Only css results/);
    expect(css`
      a {
        color: ${unsafeCSS('red')};
      }
    `.cssText).toMatch(/^\s*a \{\s*color: red;\s*\}\s*$/);
  });

  it('falls back to <style> elements with a CSP nonce and replaces them on re-adoption', () => {
    const host = mount<HTMLElement>('div');
    const root = host.attachShadow({ mode: 'open' });
    adoptStyles(root, [shared, shared], { fallback: true, nonce: 'n0nce' });
    let styles = root.querySelectorAll('style');
    expect(styles.length).toBe(1);
    expect(styles[0]?.nonce).toBe('n0nce');
    expect(getComputedStyle(host).paddingTop).toBe('4px');
    adoptStyles(root, unsafeCSS(':host { padding: 2px; }'), { fallback: true });
    styles = root.querySelectorAll('style');
    expect(styles.length).toBe(1);
    expect(getComputedStyle(host).paddingTop).toBe('2px');
  });

  it('re-adopts styles for a new document', () => {
    class Moving extends MoteElement {
      static override styles = shared;
      adoptedCalls = 0;
      protected override adopted() {
        this.adoptedCalls++;
      }
      protected override render() {
        return html`x`;
      }
    }
    const name = tag('demo-moving');
    define(name, Moving);
    const el = mount<Moving>(name);
    const before = el.shadowRoot?.adoptedStyleSheets[0];
    const frame = document.createElement('iframe');
    container.append(frame);
    const doc = frame.contentDocument as Document;
    doc.body.append(el);
    const after = el.shadowRoot?.adoptedStyleSheets[0];
    expect(el.adoptedCalls).toBe(1);
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
    expect(el.shadowRoot?.adoptedStyleSheets.length).toBe(1);
    el.remove();
  });
});

describe('events, states, and registration', () => {
  const changed = event<{ value: string }>('demo-change', {
    bubbles: true,
    composed: true,
    cancelable: true,
    syncs: 'value',
  });

  class Emitter extends MoteElement {
    static override events = { changed };
    fire(value: string) {
      return this.emit(changed, { value });
    }
    mark(on: boolean) {
      this.setState('active', on);
    }
  }
  const emitterTag = tag('demo-emitter');
  define(emitterTag, Emitter);

  it('dispatches typed events with explicit flags', () => {
    const el = mount<Emitter>(emitterTag);
    let detail: unknown;
    container.addEventListener(changed.type, (e) => {
      detail = (e as CustomEvent).detail;
      e.preventDefault();
    });
    expect(el.fire('a')).toBe(false);
    expect(detail).toEqual({ value: 'a' });
  });

  it('toggles custom states', () => {
    const el = mount<Emitter>(emitterTag);
    el.mark(true);
    expect(el.matches(':state(active)')).toBe(true);
    el.mark(false);
    expect(el.matches(':state(active)')).toBe(false);
  });

  it('defines idempotently, registers dependencies, and reports collisions', () => {
    class Child extends MoteElement {}
    class Parent extends MoteElement {
      static override dependencies = { [tag('demo-child')]: Child };
    }
    const parentTag = tag('demo-parent');
    define(parentTag, Parent);
    define(parentTag, Parent);
    expect(customElements.getName(Child)).toMatch(/^demo-child-/);
    const codeOf = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as { code?: string }).code;
      }
      return undefined;
    };
    expect(codeOf(() => define(parentTag, class extends MoteElement {}))).toBe(
      'registry.collision',
    );
    expect(codeOf(() => define(tag('demo-again'), Parent))).toBe('registry.constructorReused');
    expect(codeOf(() => define('NoHyphen', class extends MoteElement {}))).toBe(
      'registry.name.invalid',
    );
    expect(codeOf(() => define('font-face', class extends MoteElement {}))).toBe(
      'registry.name.invalid',
    );
  });
});
