import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { define, OddkinElement, prop } from '../src/element/index.js';
import { classMap } from '../src/helpers/class-map.js';
import { flush, signal } from '../src/reactive/index.js';
import { observerCount } from '../src/reactive/graph.js';
import { scopeStats, type Scope } from '../src/scope/index.js';
import { css, unsafeCSS } from '../src/styles/index.js';
import { html, render, repeat } from '../src/template/index.js';

// Core in real browsers (plan M8): keyed reorders with focus, lifecycle reentrancy, detached
// updates, moves between documents and shadow roots, and recovery after errors.
let reported: ErrorContext[];
let container: HTMLElement;
let id = 0;
const tag = (base: string) => `${base}-${++id}`;
const codes = () => reported.map((r) => r.code);

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
function mount<E extends HTMLElement>(name: string, parent: ParentNode = container): E {
  const el = document.createElement(name) as E;
  parent.append(el);
  return el;
}

/** A field with its own shadow root, as form components are. */
class Field extends OddkinElement {
  protected override render() {
    return html`<input value="0123456789" />`;
  }
  get input() {
    return this.shadowRoot?.querySelector('input') as HTMLInputElement;
  }
}
const fieldTag = tag('demo-field');
define(fieldTag, Field);

class Rows extends OddkinElement {
  readonly order = signal(['a', 'b', 'c', 'd']);
  protected override render() {
    return html`<ol>
      ${repeat(
        this.order,
        (x) => x,
        (x) => html`<li id=${x}>${x}<textarea .value=${`text ${x}`}></textarea></li>`,
      )}
    </ol>`;
  }
  row(key: string) {
    return this.shadowRoot?.getElementById(key) as HTMLLIElement;
  }
}
const rowsTag = tag('demo-rows');
define(rowsTag, Rows);

describe('keyed reorder with focus and selection', () => {
  it('a moved row keeps focus and a backward selection inside a shadow root', () => {
    const el = mount<Rows>(rowsTag);
    const area = el.row('b').querySelector('textarea') as HTMLTextAreaElement;
    area.focus();
    area.setSelectionRange(1, 4, 'backward');
    // a, c, d keep their relative order, so "b" is the row that moves.
    el.order.value = ['a', 'c', 'd', 'b'];
    flush();
    expect([...el.shadowRoot!.querySelectorAll('li')].map((li) => li.id)).toEqual([
      'a',
      'c',
      'd',
      'b',
    ]);
    expect(el.shadowRoot?.activeElement).toBe(area);
    expect([area.selectionStart, area.selectionEnd, area.selectionDirection]).toEqual([
      1,
      4,
      'backward',
    ]);
  });

  it('a moved row keeps focus in a nested component', () => {
    const order = signal(['a', 'b', 'c']);
    const fields = new Map(order.value.map((k) => [k, document.createElement(fieldTag) as Field]));
    render(
      html`<ul>
        ${repeat(
          order,
          (x) => x,
          (x) => html`<li id=${x}>${fields.get(x)}</li>`,
        )}
      </ul>`,
      container,
    );
    const field = fields.get('a') as Field;
    field.input.focus();
    field.input.setSelectionRange(2, 6);
    order.value = ['b', 'c', 'a'];
    flush();
    expect(container.querySelector('li:last-child')?.id).toBe('a');
    expect(document.activeElement).toBe(field);
    expect(field.shadowRoot?.activeElement).toBe(field.input);
    expect([field.input.selectionStart, field.input.selectionEnd]).toEqual([2, 6]);
  });
});

class Counted extends OddkinElement.with({ label: prop.string({ default: 'a' }) }) {
  readonly local = signal(0);
  renders = 0;
  connections = 0;
  pings = 0;
  updates: string[] = [];
  protected override connected(scope: Scope) {
    this.connections++;
    scope.listen(this.ownerDocument, 'demo-ping', () => this.pings++);
  }
  protected override render() {
    this.renders++;
    return html`<p>${this.label}:${this.local}</p>`;
  }
  protected override updated(changes: ReadonlyMap<string, unknown>) {
    this.updates.push([...changes.keys()].join(','));
  }
  get text() {
    return this.shadowRoot?.querySelector('p')?.textContent;
  }
}
const countedTag = tag('demo-counted');
define(countedTag, Counted);

describe('disconnect and reconnect inside an update', () => {
  it('children moved by their parent’s keyed reorder keep their state and keep updating', () => {
    const baseline = scopeStats();
    const children = new Map(['a', 'b', 'c'].map((k) => [k, document.createElement(countedTag)]));
    const order = signal(['a', 'b', 'c']);
    const root = render(
      html`${repeat(
        order,
        (k) => k,
        (k) => children.get(k),
      )}`,
      container,
    );
    const a = children.get('a') as Counted;
    a.local.value = 7;
    flush();
    order.value = ['c', 'b', 'a'];
    flush();
    a.local.value = 8;
    flush();
    document.dispatchEvent(new Event('demo-ping'));
    expect([a.text, a.pings, [...container.children].map((c) => c === a)]).toEqual([
      'a:8',
      1,
      [false, false, true],
    ]);
    root.dispose();
    expect(scopeStats()).toEqual(baseline);
  });

  it('an element an effect removes and re-adds during a flush ends with the latest values and one connection', async () => {
    const trigger = signal(0);
    const target = mount<Counted>(countedTag);
    class Mover extends OddkinElement {
      protected override mounted(scope: Scope) {
        scope.effect(() => {
          if (!trigger.value) return;
          target.remove();
          container.append(target);
        });
      }
    }
    const moverTag = tag('demo-mover');
    define(moverTag, Mover);
    mount(moverTag);
    await target.updateComplete;
    const before = { renders: target.renders, updates: target.updates.length };
    target.label = 'b';
    trigger.value = 1;
    await target.updateComplete;
    document.dispatchEvent(new Event('demo-ping'));
    expect(target.text).toBe('b:0');
    // The pending render runs in the commit phase; the reconnection renders again.
    expect(target.renders - before.renders).toBe(2);
    expect(target.updates.slice(before.updates)).toEqual(['label']);
    expect([target.connections, target.pings]).toEqual([2, 1]);
  });

  it('removed and re-added before the flush, an element renders once with the latest values', async () => {
    const el = mount<Counted>(countedTag);
    await el.updateComplete;
    el.label = 'x';
    el.remove();
    container.append(el);
    await el.updateComplete;
    expect([el.text, el.renders, el.updates]).toEqual(['x:0', 2, ['', 'label']]);
  });
});

describe('updates to detached elements', () => {
  it('a never-connected element renders nothing, then the latest values once on connection', () => {
    const el = document.createElement(countedTag) as Counted;
    el.label = 'b';
    el.local.value = 3;
    flush();
    expect([el.renders, el.shadowRoot]).toEqual([0, null]);
    container.append(el);
    expect([el.renders, el.text]).toEqual([1, 'b:3']);
  });

  it('render() into a detached container keeps its bindings live until disposed', () => {
    const detached = document.createElement('div');
    const n = signal(1);
    const root = render(html`<p>${n}</p>`, detached);
    n.value = 2;
    flush();
    expect(detached.textContent).toBe('2');
    root.dispose();
    n.value = 3;
    flush();
    expect([detached.textContent, observerCount(n)]).toEqual(['', 0]);
  });

  it('a detached element settles; its pending writes render when it reconnects', async () => {
    const el = mount<Counted>(countedTag);
    await el.updateComplete;
    el.remove();
    el.local.value = 4;
    el.label = 'z';
    await el.updateComplete;
    expect([el.text, el.renders]).toEqual(['a:0', 1]);
    container.append(el);
    expect(el.text).toBe('z:4');
  });
});

const padded = css`
  :host {
    display: block;
    padding-top: 5px;
  }
`;
class Traveller extends Counted {
  static override styles = padded;
  adoptions = 0;
  protected override adopted() {
    this.adoptions++;
  }
}
const travellerTag = tag('demo-traveller');
define(travellerTag, Traveller);

describe('moves between documents and shadow roots', () => {
  const frameDocument = () => {
    const frame = document.createElement('iframe');
    container.append(frame);
    return frame.contentDocument as Document;
  };

  it('into another document: adopted, styled there, its listeners follow its document, and it keeps updating', () => {
    const baseline = scopeStats();
    const el = mount<Traveller>(travellerTag);
    const doc = frameDocument();
    doc.body.append(el);
    el.local.value = 2;
    flush();
    document.dispatchEvent(new Event('demo-ping'));
    doc.dispatchEvent(new Event('demo-ping'));
    expect([el.adoptions, el.connections, el.pings, el.text]).toEqual([1, 2, 1, 'a:2']);
    expect(doc.defaultView?.getComputedStyle(el).paddingTop).toBe('5px');
    container.append(el);
    el.local.value = 3;
    flush();
    expect([el.adoptions, el.text, getComputedStyle(el).paddingTop]).toEqual([2, 'a:3', '5px']);
    el.remove();
    expect(scopeStats()).toEqual(baseline);
  });

  it('adopted while detached, then inserted', () => {
    const el = mount<Traveller>(travellerTag);
    el.remove();
    const doc = frameDocument();
    doc.adoptNode(el);
    expect([el.adoptions, el.ownerDocument]).toEqual([1, doc]);
    doc.body.append(el);
    el.label = 'b';
    flush();
    expect([el.text, doc.defaultView?.getComputedStyle(el).paddingTop]).toEqual(['b:0', '5px']);
  });

  it('between shadow roots: rendering and light-DOM styles follow the element', () => {
    const name = tag('demo-light');
    class Light extends OddkinElement {
      static override shadowRootOptions = null;
      static override styles = unsafeCSS(`${name} { display: block; padding-top: 7px; }`);
      readonly n = signal(0);
      protected override render() {
        return html`<span>${this.n}</span>`;
      }
    }
    define(name, Light);
    const roots = [0, 1].map(() => mount('div').attachShadow({ mode: 'open' }));
    const [first, second] = roots as [ShadowRoot, ShadowRoot];
    const light = mount<Light>(name, first);
    const shadowed = mount<Traveller>(travellerTag, first);
    second.append(light, shadowed);
    light.n.value = 1;
    shadowed.local.value = 1;
    flush();
    expect([first.adoptedStyleSheets.length, second.adoptedStyleSheets.length]).toEqual([0, 1]);
    expect([getComputedStyle(light).paddingTop, light.textContent]).toEqual(['7px', '1']);
    expect([getComputedStyle(shadowed).paddingTop, shadowed.text]).toEqual(['5px', 'a:1']);
  });
});

describe('recovery after errors', () => {
  it('a template that fails while committing releases what it bound; the next good render works', () => {
    class Broken extends OddkinElement {
      readonly bad = signal(false);
      readonly label = signal('ok');
      protected override render() {
        return this.bad.value
          ? html`<b>${this.label}</b><i title=${classMap({ x: true })}></i>`
          : html`<p>${this.label}</p>`;
      }
    }
    const name = tag('demo-broken');
    define(name, Broken);
    const el = mount<Broken>(name);
    el.bad.value = true;
    flush();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(el.shadowRoot?.querySelectorAll('p, b, i')).toHaveLength(0);
    expect(observerCount(el.label)).toBe(0);
    el.bad.value = false;
    flush();
    el.label.value = 'again';
    flush();
    expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('again');
    expect(el.shadowRoot?.querySelectorAll('p, b, i')).toHaveLength(1);
    expect(observerCount(el.label)).toBe(1);
  });

  it('a repeat item template that throws leaves the list as it was; the next good list renders exactly', () => {
    const items = signal(['a', 'b', 'c']);
    render(
      html`<ul>
        ${repeat(
          items,
          (x) => x,
          (x) => {
            if (x === 'bad') throw new Error('bad item');
            return html`<li>${x}</li>`;
          },
        )}
      </ul>`,
      container,
    );
    const texts = () => [...container.querySelectorAll('li')].map((li) => li.textContent);
    expect(() => {
      items.value = ['a', 'e', 'bad', 'c'];
      flush();
    }).not.toThrow();
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(texts()).toEqual(['a', 'b', 'c']);
    items.value = ['c', 'd', 'a'];
    flush();
    expect(texts()).toEqual(['c', 'd', 'a']);
  });

  it('an effect run that throws releases what it registered; the next run works', () => {
    const baseline = scopeStats();
    const trigger = signal(0);
    const runs: number[] = [];
    class Effected extends OddkinElement {
      protected override connected(scope: Scope) {
        scope.effect((run) => {
          run.listen(window, 'demo-effect', () => {});
          if (trigger.value === 0) throw new Error('first run fails');
          runs.push(trigger.value);
        });
      }
      protected override render() {
        return html`<p>rendered</p>`;
      }
    }
    const name = tag('demo-effected');
    define(name, Effected);
    const el = mount<Effected>(name);
    expect(codes()).toEqual(['reactive.effect.error']);
    expect(el.shadowRoot?.textContent).toBe('rendered');
    const listeners = scopeStats().listeners;
    trigger.value = 1;
    flush();
    expect([runs, scopeStats().listeners]).toEqual([[1], listeners + 1]);
    el.remove();
    expect(scopeStats()).toEqual(baseline);
  });
});
