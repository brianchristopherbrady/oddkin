import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { define, emit, event, OddkinElement, prop } from '../src/element/index.js';
import { computed, flush, signal } from '../src/reactive/index.js';
import { observerCount } from '../src/reactive/graph.js';
import { createScope, scopeStats, type Scope } from '../src/scope/index.js';
import {
  ATTRIBUTE_DIRECTIVE,
  html,
  render,
  type AttributeDirective,
  type DirectiveHandler,
} from '../src/template/index.js';

// Authoring semantics (plan §3.1; core-contracts.md §2–§6): the binding rule's remaining cases,
// template lifecycle, constructors, Scope examples, the directive extension contract, and events.
let reported: ErrorContext[];
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;
const text = (el: Element, selector = 'p') => el.shadowRoot?.querySelector(selector)?.textContent;

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
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe('binding rule: helpers, deferred reads, and public properties', () => {
  it('reads inside synchronous helpers called from render() are tracked', () => {
    class Helped extends OddkinElement {
      readonly first = signal('Ada');
      renders = 0;
      greeting() {
        return `Hello ${this.first.value}`;
      }
      protected override render() {
        this.renders++;
        return html`<p>${this.greeting()}</p>`;
      }
    }
    const name = tag('demo-helped');
    define(name, Helped);
    const el = mount<Helped>(name);
    el.first.value = 'Lin';
    flush();
    expect([el.renders, text(el)]).toEqual([2, 'Hello Lin']);
  });

  it('reads in a callback render() schedules are snapshots, not dependencies', async () => {
    class Deferred extends OddkinElement {
      readonly count = signal(0);
      renders = 0;
      readonly seen: number[] = [];
      protected override render() {
        this.renders++;
        queueMicrotask(() => this.seen.push(this.count.value));
        return html`<p>x</p>`;
      }
    }
    const name = tag('demo-deferred');
    define(name, Deferred);
    const el = mount<Deferred>(name);
    await Promise.resolve();
    el.count.value = 1;
    flush();
    await Promise.resolve();
    expect([el.renders, el.seen]).toEqual([1, [0]]);
  });

  it('a public property read in render() re-renders; read through a bound computed it does not', () => {
    class Labelled extends OddkinElement.with({
      label: prop.string({ default: 'a' }),
      note: prop.string({ default: 'x' }),
    }) {
      renders = 0;
      readonly loud = computed(() => this.note.toUpperCase());
      protected override render() {
        this.renders++;
        return html`<p>${this.label}</p>
          <b>${this.loud}</b>`;
      }
    }
    const name = tag('demo-labelled');
    define(name, Labelled);
    const el = mount<Labelled>(name);
    el.note = 'y';
    flush();
    expect([el.renders, text(el, 'b')]).toEqual([1, 'Y']);
    el.label = 'b';
    flush();
    expect([el.renders, text(el)]).toEqual([2, 'b']);
  });
});

describe('template lifecycle', () => {
  it('creates an instance once, updates it in place, and disposes it when another template replaces it', () => {
    const count = signal('1');
    const italic = (v: unknown) => html`<i>${v}</i>`;
    const bold = (v: unknown) => html`<b>${v}</b>`;
    const view = (content: unknown) => html`<p>${content}</p>`;
    render(view(italic(count)), container);
    const i = container.querySelector('i');
    render(view(italic(count)), container);
    expect(container.querySelector('i')).toBe(i);
    expect(observerCount(count)).toBe(1);
    render(view(bold('2')), container);
    expect([i?.isConnected, observerCount(count), container.textContent]).toEqual([false, 0, '2']);
  });

  it('pauses with its host and resumes with the same nodes and the current values', () => {
    class Host extends OddkinElement {
      readonly n = signal(0);
      protected override render() {
        return html`<p>${html`<i>${this.n}</i>`}</p>`;
      }
    }
    const name = tag('demo-host');
    define(name, Host);
    const el = mount<Host>(name);
    const i = el.shadowRoot?.querySelector('i');
    el.remove();
    expect(observerCount(el.n)).toBe(0);
    el.n.value = 5;
    flush();
    expect(i?.textContent).toBe('0');
    container.append(el);
    expect(el.shadowRoot?.querySelector('i')).toBe(i);
    expect([i?.textContent, observerCount(el.n)]).toEqual(['5', 1]);
  });

  it('leaves slotted children to the page whatever the template renders', () => {
    class Slotting extends OddkinElement {
      readonly open = signal(true);
      protected override render() {
        return this.open.value ? html`<section><slot></slot></section>` : html`<p>closed</p>`;
      }
    }
    const name = tag('demo-slotting');
    define(name, Slotting);
    const el = document.createElement(name) as Slotting;
    const child = document.createElement('span');
    el.append(child);
    container.append(el);
    expect(child.assignedSlot).not.toBeNull();
    el.open.value = false;
    flush();
    expect(child.parentNode).toBe(el);
    expect(child.assignedSlot).toBeNull();
    el.open.value = true;
    flush();
    expect(child.assignedSlot).not.toBeNull();
    el.remove();
    expect(child.parentNode).toBe(el);
  });
});

describe('constructors', () => {
  class Built extends OddkinElement.with({
    tone: prop.enum(['calm', 'loud'], { default: 'calm', reflect: true }),
    label: prop.string({ default: 'x' }),
  }) {
    protected override render() {
      return html`<p>${this.label}</p>`;
    }
  }
  const builtTag = tag('demo-built');
  define(builtTag, Built);

  it('a constructed element owns nothing and has no attributes, children, or shadow root', () => {
    const before = scopeStats();
    for (const el of [document.createElement(builtTag), new Built()]) {
      expect([el.attributes.length, el.childNodes.length, el.shadowRoot]).toEqual([0, 0, null]);
    }
    expect(scopeStats()).toEqual(before);
  });

  it('public properties are prototype accessors, set before connection and applied on it', () => {
    const el = document.createElement(builtTag) as Built;
    expect(['label' in el, Object.hasOwn(el, 'label')]).toEqual([true, false]);
    el.label = 'early';
    el.tone = 'loud';
    expect(el.hasAttribute('tone')).toBe(false);
    container.append(el);
    expect([text(el), el.getAttribute('tone')]).toEqual(['early', 'loud']);
  });
});

/** A child scope that also ends when `external` aborts; already aborted, it starts disposed. */
function follow(scope: Scope, external: AbortSignal): Scope {
  const work = scope.child();
  if (external.aborted) work.dispose(external.reason);
  else work.listen(external, 'abort', () => work.dispose(external.reason));
  return work;
}
const frames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

describe('Scope examples (core-contracts.md §4)', () => {
  it('listeners on external targets and observers end with the scope', async () => {
    const scope = createScope({ name: 'example' });
    const seen: string[] = [];
    scope.listen(window, 'example-ping', () => seen.push('ping'));
    const target = document.createElement('div');
    container.append(target);
    const observer = new ResizeObserver(() => seen.push('resize'));
    observer.observe(target);
    scope.add(() => observer.disconnect(), 'resize observer');
    window.dispatchEvent(new Event('example-ping'));
    scope.dispose();
    window.dispatchEvent(new Event('example-ping'));
    target.style.width = '10px';
    await frames();
    expect(seen).toEqual(['ping']);
  });

  it('timers are cancelled by early release and by disposal', async () => {
    const scope = createScope();
    const fired: string[] = [];
    scope.timeout(() => fired.push('released'), 0)();
    scope.timeout(() => fired.push('timeout'), 0);
    scope.interval(() => fired.push('interval'), 0);
    scope.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).toEqual([]);
  });

  it('a fetch given the scope signal is aborted; the reason is read from the signal', async () => {
    const scope = createScope();
    const request = fetch(location.href, { signal: scope.signal });
    const reason = new DOMException('The view closed', 'AbortError');
    scope.dispose(reason);
    // Chromium and Firefox reject with the reason; WebKit 27.2 with its own AbortError.
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(scope.signal.reason).toBe(reason);
  });

  it("a caller's signal: joined with AbortSignal.any, or followed by a child scope", () => {
    const scope = createScope();
    const caller = new AbortController();
    const joined = AbortSignal.any([scope.signal, caller.signal]);
    const listeners = scopeStats().listeners;
    const work = follow(scope, caller.signal);
    caller.abort('cancelled by the caller');
    expect([joined.reason, work.disposed, work.signal.reason, scope.disposed]).toEqual([
      'cancelled by the caller',
      true,
      'cancelled by the caller',
      false,
    ]);
    expect(scopeStats().listeners).toBe(listeners);
    scope.dispose();
  });

  it('an already-aborted signal starts nothing', async () => {
    const scope = createScope();
    const work = follow(scope, AbortSignal.abort('gone'));
    const started: string[] = [];
    work.timeout(() => started.push('timer'), 0);
    work.listen(window, 'example-ping', () => started.push('listener'));
    window.dispatchEvent(new Event('example-ping'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect([work.disposed, work.signal.reason, started]).toEqual([true, 'gone', []]);
    scope.dispose();
  });

  it('disposal inside a callback stops the rest of the scope at once', () => {
    const scope = createScope();
    const seen: string[] = [];
    scope.listen(window, 'example-close', () => {
      seen.push('first');
      scope.dispose();
    });
    scope.listen(window, 'example-close', () => seen.push('second'));
    window.dispatchEvent(new Event('example-close'));
    window.dispatchEvent(new Event('example-close'));
    expect(seen).toEqual(['first']);
  });

  it('work that ignores the signal is guarded where it commits', async () => {
    const scope = createScope();
    const committed: string[] = [];
    let resolve!: (value: string) => void;
    const slow = new Promise<string>((r) => (resolve = r));
    void slow.then((value) => {
      if (!scope.signal.aborted) committed.push(value);
    });
    scope.dispose();
    resolve('late');
    await slow;
    await Promise.resolve();
    expect(committed).toEqual([]);
  });
});

describe('extension contract: attribute directives', () => {
  interface Mark extends AttributeDirective {
    readonly on: boolean;
  }
  let log: string[];
  beforeEach(() => (log = []));
  const marker: DirectiveHandler<Mark, { applied: number }> = {
    name: 'mark',
    parts: ['attribute'],
    bindingName: 'data-mark',
    apply(directive, element, binding, state) {
      const applied = (state?.applied ?? 0) + 1;
      log.push(`mark ${binding.type} ${binding.name} ${applied}`);
      element.toggleAttribute('data-mark', directive.on);
      return { state: { applied }, changed: true };
    },
    clear(element, state) {
      log.push(`clear mark ${state.applied}`);
      element.removeAttribute('data-mark');
    },
  };
  const other: DirectiveHandler<AttributeDirective, true> = {
    name: 'other',
    parts: ['attribute'],
    apply() {
      log.push('other');
      return { state: true, changed: false };
    },
  };
  const mark = (on: boolean): Mark => ({ [ATTRIBUTE_DIRECTIVE]: marker, on });
  const view = (v: unknown) => html`<p data-mark=${v}></p>`;

  it('keeps state per binding while the handler stays, and clears for a plain value and on disposal', () => {
    const root = render(view(mark(true)), container);
    render(view(mark(false)), container);
    expect(container.querySelector('p')?.hasAttribute('data-mark')).toBe(false);
    render(view('plain'), container);
    expect(container.querySelector('p')?.getAttribute('data-mark')).toBe('plain');
    render(view(mark(true)), container);
    root.dispose();
    expect(log).toEqual([
      'mark attribute data-mark 1',
      'mark attribute data-mark 2',
      'clear mark 2',
      'mark attribute data-mark 1',
      'clear mark 1',
    ]);
  });

  it('another handler on the same binding clears the previous one first', () => {
    render(view(mark(true)), container);
    render(view({ [ATTRIBUTE_DIRECTIVE]: other }), container);
    expect(log).toEqual(['mark attribute data-mark 1', 'clear mark 1', 'other']);
  });

  it('a directive outside the binding it accepts is an error at the call', () => {
    expect(codeOf(() => render(html`<p title=${mark(true)}></p>`, container))).toBe(
      'template.directive.binding',
    );
    expect(codeOf(() => render(html`<p data-mark="a ${mark(true)}"></p>`, container))).toBe(
      'template.directive.position',
    );
  });
});

describe('event semantics', () => {
  const picked = event<{ value: string }>('demo-picked', {
    bubbles: true,
    composed: true,
    cancelable: true,
    intent: 'user',
  });
  const inner = event('demo-inner', { bubbles: true, composed: false, cancelable: false });
  class Picker extends OddkinElement.with({ value: prop.string() }) {
    static override events = { picked };
    seen: Array<{ target: EventTarget | null; currentTarget: EventTarget | null; self: unknown }> =
      [];
    updates = 0;
    protected override render() {
      return html`<button type="button" @click=${this.choose}>Pick</button>`;
    }
    choose(e: Event) {
      this.seen.push({ target: e.target, currentTarget: e.currentTarget, self: this });
      if (this.emit(picked, { value: 'b' })) this.value = 'b';
    }
    protected override updated() {
      this.updates++;
    }
  }
  const pickerTag = tag('demo-picker');
  define(pickerTag, Picker);
  const button = (el: Picker) => el.shadowRoot?.querySelector('button') as HTMLButtonElement;

  it('a template listener sees its own element; outside, the event is retargeted to the host', () => {
    const el = mount<Picker>(pickerTag);
    let outside: { target: EventTarget | null; path: EventTarget[] } | undefined;
    container.addEventListener(
      'click',
      (e) => (outside = { target: e.target, path: e.composedPath() }),
    );
    button(el).click();
    const [own] = el.seen;
    expect(own?.target).toBe(button(el));
    expect(own?.currentTarget).toBe(button(el));
    expect(own?.self).toBe(el);
    expect(outside?.target).toBe(el);
    expect(outside?.path[0]).toBe(button(el));
    expect(outside?.path[1]).toBe(el.shadowRoot);
    expect(outside?.path[2]).toBe(el);
  });

  it('emitted events carry their declared flags; a cancelled one is reported to the emitter', () => {
    const el = mount<Picker>(pickerTag);
    let target: EventTarget | null = null;
    let flags: unknown;
    const cancel = (e: Event) => {
      target = e.target;
      flags = [e.bubbles, e.composed, e.cancelable];
      e.preventDefault();
    };
    document.addEventListener(picked.type, cancel);
    button(el).click();
    document.removeEventListener(picked.type, cancel);
    expect(target).toBe(el);
    expect([flags, el.value]).toEqual([[true, true, true], undefined]);
    button(el).click();
    expect(el.value).toBe('b');
  });

  it('an event that is not composed stays inside the shadow tree', () => {
    const el = mount<Picker>(pickerTag);
    const seen: string[] = [];
    container.addEventListener(inner.type, () => seen.push('outside'));
    el.shadowRoot?.addEventListener(inner.type, () => seen.push('inside'));
    emit(button(el), inner);
    expect(seen).toEqual(['inside']);
  });

  it('a property write emits nothing, so a listener that writes the property back cannot loop', async () => {
    const el = mount<Picker>(pickerTag);
    await el.updateComplete;
    const events: string[] = [];
    el.addEventListener(picked.type, (e) => {
      const { value } = (e as CustomEvent<{ value: string }>).detail;
      events.push(value);
      el.value = value;
    });
    button(el).click();
    el.value = 'c';
    el.value = 'c';
    await el.updateComplete;
    expect([events, el.value, el.updates]).toEqual([['b'], 'c', 2]);
  });
});
