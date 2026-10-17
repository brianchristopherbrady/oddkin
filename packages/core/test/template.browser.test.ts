import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { computed, flush, signal } from '../src/reactive/index.js';
import { observerCount } from '../src/reactive/graph.js';
import { BLOCKED_URL, html, match, render, repeat, svg, when } from '../src/template/index.js';

let reported: ErrorContext[];
let container: HTMLElement;

beforeEach(() => {
  reported = [];
  setErrorHandler((_error, context) => reported.push(context));
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  flush();
  container.remove();
  setErrorHandler(undefined);
});

const text = () => container.textContent?.replace(/\s+/g, ' ').trim();

describe('child bindings', () => {
  it('renders primitives as text and never parses markup', () => {
    render(html`<p>${'<b>bold</b>'} ${42}</p>`, container);
    expect(container.querySelector('b')).toBeNull();
    expect(text()).toBe('<b>bold</b> 42');
  });

  it('renders nothing for null, undefined, and false', () => {
    const view = (v: unknown) => html`<p>[${v}]</p>`;
    for (const v of [null, undefined, false]) {
      render(view(v), container);
      expect(text()).toBe('[]');
    }
    render(view(0), container);
    expect(text()).toBe('[0]');
  });

  it('updates an existing text node in place', () => {
    const view = (v: string) => html`<p>${v}</p>`;
    render(view('a'), container);
    const node = container.querySelector('p')?.firstChild;
    render(view('b'), container);
    expect(container.querySelector('p')?.firstChild).toBe(node);
    expect(text()).toBe('b');
  });

  it('reuses nested template instances and replaces different templates', () => {
    const inner = (v: string) => html`<em>${v}</em>`;
    const other = () => html`<strong>other</strong>`;
    const outer = (content: unknown) => html`<p>${content}</p>`;
    render(outer(inner('a')), container);
    const em = container.querySelector('em');
    render(outer(inner('b')), container);
    expect(container.querySelector('em')).toBe(em);
    expect(text()).toBe('b');
    render(outer(other()), container);
    expect(container.querySelector('em')).toBeNull();
    expect(text()).toBe('other');
  });

  it('inserts dynamic top-level content of nested templates', () => {
    const inner = (v: string) => html`${v}<i>static</i>`;
    render(html`<p>${inner('lead ')}</p>`, container);
    expect(text()).toBe('lead static');
    render(html`<p>${null}</p>`, container);
    expect(text()).toBe('');
  });

  it('renders nodes and arrays', () => {
    const node = document.createElement('span');
    node.textContent = 'node';
    render(html`<p>${node} ${['a', 'b', html`<b>c</b>`]}</p>`, container);
    expect(text()).toBe('node abc');
    render(html`<p>${node} ${['a']}</p>`, container);
    expect(text()).toBe('node a');
  });

  it('never calls interpolated functions', () => {
    let called = false;
    render(html`<p>${() => (called = true)}</p>`, container);
    expect(called).toBe(false);
    expect(reported.map((r) => r.code)).toEqual(['template.value.function']);
  });
});

describe('readable bindings', () => {
  it('update their part directly and keep node identity', () => {
    const count = signal(1);
    let renders = 0;
    const view = () => {
      renders++;
      return html`<p>Count: ${count}</p>`;
    };
    render(view(), container);
    const p = container.querySelector('p');
    count.value = 2;
    flush();
    expect(text()).toBe('Count: 2');
    expect(container.querySelector('p')).toBe(p);
    expect(renders).toBe(1);
  });

  it('bind attribute, boolean, and property parts', () => {
    const label = signal('one');
    const off = signal(false);
    const val = signal('typed');
    render(html`<input aria-label="field ${label}" ?disabled=${off} .value=${val} />`, container);
    const input = container.querySelector('input') as HTMLInputElement;
    expect([input.getAttribute('aria-label'), input.disabled, input.value]).toEqual([
      'field one',
      false,
      'typed',
    ]);
    label.value = 'two';
    off.value = true;
    val.value = 'next';
    flush();
    expect([input.getAttribute('aria-label'), input.disabled, input.value]).toEqual([
      'field two',
      true,
      'next',
    ]);
  });

  it('write once when a value changes through a binding (no duplicate DOM writes)', async () => {
    const count = signal(0);
    render(html`<p>${count}</p>`, container);
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(container, { subtree: true, characterData: true, childList: true });
    count.value = 1;
    count.value = 2;
    flush();
    await Promise.resolve();
    observer.disconnect();
    expect(records.length).toBe(1);
    expect(text()).toBe('2');
  });

  it('release their subscription when the part is disposed', () => {
    const count = signal(0);
    const root = render(html`<p>${count}</p>`, container);
    expect(observerCount(count)).toBe(1);
    root.dispose();
    expect(observerCount(count)).toBe(0);
  });
});

describe('attribute parts', () => {
  it('interpolate multiple values and remove the attribute for null', () => {
    const view = (a: string, t: string | null) => html`<p class="x ${a} y" title=${t}></p>`;
    render(view('mid', 'tip'), container);
    const p = container.querySelector('p') as HTMLElement;
    expect([p.className, p.title]).toEqual(['x mid y', 'tip']);
    render(view('end', null), container);
    expect([p.className, p.hasAttribute('title')]).toEqual(['x end y', false]);
  });

  it('preserve property-name case', () => {
    render(html`<input type="number" .valueAsNumber=${7} />`, container);
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('7');
  });
});

describe('event parts', () => {
  it('swap handlers without re-adding listeners and call with the host as this', () => {
    const host = { name: 'host' };
    const calls: string[] = [];
    function first(this: { name: string }) {
      calls.push(`first:${this.name}`);
    }
    function second(this: { name: string }) {
      calls.push(`second:${this.name}`);
    }
    const view = (fn: (() => void) | null) => html`<button @click=${fn}>go</button>`;
    render(view(first), container, { host });
    const button = container.querySelector('button') as HTMLButtonElement;
    button.click();
    render(view(second), container, { host });
    button.click();
    render(view(null), container, { host });
    button.click();
    expect(calls).toEqual(['first:host', 'second:host']);
  });
});

describe('structural helpers', () => {
  it('when() with a readable switches branches and disposes the inactive one', () => {
    const open = signal(true);
    const inner = signal('inside');
    render(
      html`<div>
        ${when(
          open,
          () => html`<b>${inner}</b>`,
          () => 'closed',
        )}
      </div>`,
      container,
    );
    expect(text()).toBe('inside');
    expect(observerCount(inner)).toBe(1);
    open.value = false;
    flush();
    expect(text()).toBe('closed');
    expect(observerCount(inner)).toBe(0);
  });

  it('match() selects a case', () => {
    const state = signal<'idle' | 'busy'>('idle');
    render(
      html`<p>${match(state, { idle: () => 'Idle', busy: () => html`<i>Busy</i>` })}</p>`,
      container,
    );
    expect(text()).toBe('Idle');
    state.value = 'busy';
    flush();
    expect(text()).toBe('Busy');
  });

  it('repeat() reuses DOM per key across reorders and releases removed items', () => {
    const labels = new Map([
      [1, signal('one')],
      [2, signal('two')],
      [3, signal('three')],
    ]);
    const items = signal([1, 2, 3]);
    render(
      html`<ul>
        ${repeat(
          items,
          (id) => id,
          (id) => html`<li data-id=${id}>${labels.get(id)}</li>`,
        )}
      </ul>`,
      container,
    );
    const before = new Map(
      [...container.querySelectorAll('li')].map((li) => [li.dataset['id'], li]),
    );
    items.value = [3, 1, 2];
    flush();
    const after = [...container.querySelectorAll('li')];
    expect(after.map((li) => li.textContent)).toEqual(['three', 'one', 'two']);
    expect(after.map((li) => before.get(li.dataset['id']))).toEqual(after);
    items.value = [1];
    flush();
    expect(text()).toBe('one');
    expect(observerCount(labels.get(2) as never)).toBe(0);
    expect(observerCount(labels.get(3) as never)).toBe(0);
  });

  it('repeat() item templates track their own reads', () => {
    const suffix = signal('!');
    const items = signal(['a', 'b']);
    render(
      html`<p>
        ${repeat(
          items,
          (x) => x,
          (x) => html`<span>${x}${computed(() => suffix.value)}</span>`,
        )}
      </p>`,
      container,
    );
    suffix.value = '?';
    flush();
    expect(text()).toBe('a?b?');
  });

  it('repeat() moves only items outside the longest stable run', async () => {
    const order = signal(['a', 'b', 'c', 'd', 'e']);
    render(
      html`<ul>
        ${repeat(
          order,
          (x) => x,
          (x) => html`<li id=${x}>${x}</li>`,
        )}
      </ul>`,
      container,
    );
    const moved = new Set<string>();
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) if (node instanceof HTMLElement) moved.add(node.id);
    });
    observer.observe(container.querySelector('ul') as HTMLElement, { childList: true });
    order.value = ['e', 'b', 'c', 'd', 'a'];
    flush();
    await Promise.resolve();
    observer.disconnect();
    expect([...container.querySelectorAll('li')].map((li) => li.id)).toEqual([
      'e',
      'b',
      'c',
      'd',
      'a',
    ]);
    expect([...moved].sort()).toEqual(['a', 'e']);
  });

  it('repeat() restores focus and selection when the focused item itself moves', () => {
    const order = signal(['a', 'b', 'c', 'd']);
    render(
      html`<ol>
        ${repeat(
          order,
          (x) => x,
          (x) => html`<li><input id=${`in-${x}`} value=${`value ${x}`} /></li>`,
        )}
      </ol>`,
      container,
    );
    const input = container.querySelector('#in-a') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 5);
    // b, c, d keep their relative order, so "a" is the item that moves.
    order.value = ['b', 'c', 'd', 'a'];
    flush();
    expect([...container.querySelectorAll('input')].map((i) => i.id)).toEqual([
      'in-b',
      'in-c',
      'in-d',
      'in-a',
    ]);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5]);
  });

  it('repeat() keeps order and DOM identity across randomized reorders, inserts, and removals', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let next = 0;
    const order = signal<number[]>(Array.from({ length: 30 }, () => next++));
    render(
      html`<ul>
        ${repeat(
          order,
          (x) => x,
          (x) => html`<li data-id=${x}>${x}</li>`,
        )}
      </ul>`,
      container,
    );
    const nodes = new Map<number, Element>();
    for (let round = 0; round < 60; round++) {
      for (const li of container.querySelectorAll('li')) nodes.set(Number(li.textContent), li);
      const current = order.value;
      let updated = [...current];
      const op = round % 4;
      if (op === 0) updated.sort(() => random() - 0.5);
      else if (op === 1) updated.splice(Math.floor(random() * updated.length), 0, next++, next++);
      else if (op === 2) updated = updated.filter(() => random() > 0.2);
      else updated = [...updated].reverse().concat(next++);
      order.value = updated;
      flush();
      const lis = [...container.querySelectorAll('li')];
      expect(lis.map((li) => Number(li.textContent))).toEqual(updated);
      for (const li of lis) {
        const id = Number(li.textContent);
        if (current.includes(id)) expect(li, `item ${id} reused`).toBe(nodes.get(id));
      }
    }
  });

  it('repeat() reports duplicate keys', () => {
    render(
      html`<p>
        ${repeat(
          ['a', 'a'],
          (x) => x,
          (x) => x,
        )}
      </p>`,
      container,
    );
    expect(text()).toBe('aa');
    expect(reported.map((r) => r.code)).toEqual(['template.repeat.duplicateKey']);
  });

  it('keeps focus in a bound input across updates', () => {
    const hint = signal('a');
    render(html`<label>${hint}<input /></label>`, container);
    const input = container.querySelector('input') as HTMLInputElement;
    input.focus();
    hint.value = 'b';
    flush();
    expect(document.activeElement).toBe(input);
  });
});

describe('svg', () => {
  it('creates SVG-namespace elements', () => {
    const r = signal(4);
    render(
      html`<svg viewBox="0 0 10 10">${svg`<circle cx="5" cy="5" r=${r}></circle>`}</svg>`,
      container,
    );
    const circle = container.querySelector('circle') as SVGCircleElement;
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.getAttribute('r')).toBe('4');
  });
});

describe('security', () => {
  it('blocks script URLs in URL attributes and properties', () => {
    // eslint-disable-next-line no-script-url
    const bad = ' JaVa\tScRiPt:alert(1)';
    render(html`<a href=${bad}>x</a><img .src=${bad} />`, container);
    expect(container.querySelector('a')?.getAttribute('href')).toBe(BLOCKED_URL);
    expect((container.querySelector('img') as HTMLImageElement).src).toBe(BLOCKED_URL);
    expect(reported.map((r) => r.code)).toEqual(['template.url.unsafe', 'template.url.unsafe']);
  });

  it('allows ordinary URLs', () => {
    render(html`<a href=${'/docs?x=1'}>x</a>`, container);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/docs?x=1');
  });
});
