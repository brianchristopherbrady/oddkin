import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { flush, signal } from '../src/reactive/index.js';
import { classMap } from '../src/helpers/class-map.js';
import { styleMap } from '../src/helpers/style-map.js';
import { html, render, svg } from '../src/template/index.js';

// The binding-value matrix (core-contracts.md §6.1): what each kind of value does in each binding
// position. A value a position has no meaning for is reported, never guessed.
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
const codes = () => reported.map((r) => r.code);
const el = <T extends Element = HTMLElement>(selector = 'p') =>
  container.querySelector(selector) as T;
/** Rendered nodes, without the parts' comment markers. */
const nodes = (parent: Node) =>
  [...parent.childNodes].filter((n) => n.nodeType !== Node.COMMENT_NODE);

describe('binding-value matrix: child position', () => {
  const view = (v: unknown) => html`<p>${v}</p>`;
  it('empty values render nothing; the empty string renders an empty text node', () => {
    for (const v of [null, undefined, false]) {
      render(view(v), container);
      expect(nodes(el()).length, String(v)).toBe(0);
    }
    render(view(''), container);
    expect(nodes(el()).map((n) => n.nodeType)).toEqual([Node.TEXT_NODE]);
    expect(el().textContent).toBe('');
  });
  it('true, numbers, bigints, and 0 render as text', () => {
    for (const [v, t] of [
      [true, 'true'],
      [0, '0'],
      [1.5, '1.5'],
      [10n, '10'],
      [NaN, 'NaN'],
    ] as const) {
      render(view(v), container);
      expect(el().textContent).toBe(t);
    }
    expect(codes()).toEqual([]);
  });
  it('functions and plain objects are reported and render nothing', () => {
    render(
      view(() => 'x'),
      container,
    );
    expect(el().textContent).toBe('');
    render(view({ a: 1 }), container);
    expect(el().textContent).toBe('');
    render(view(Object.create(null)), container);
    expect(el().textContent).toBe('');
    expect(codes()).toEqual([
      'template.value.function',
      'template.value.object',
      'template.value.object',
    ]);
  });
  it('a symbol is reported and renders nothing', () => {
    render(view(Symbol('s')), container);
    expect(el().textContent).toBe('');
    expect(codes()).toEqual(['template.value.symbol']);
  });
  it('an object with its own string form renders that text', () => {
    render(view(new URL('https://example.com/a')), container);
    expect(el().textContent).toBe('https://example.com/a');
    expect(codes()).toEqual([]);
  });
});

describe('binding-value matrix: attribute position', () => {
  const view = (v: unknown) => html`<p title=${v} data-x="a ${v} b"></p>`;
  it('null and undefined remove the attribute; the empty string keeps it empty; false is text', () => {
    render(view('x'), container);
    for (const v of [null, undefined]) {
      render(view(v), container);
      expect(el().hasAttribute('title'), String(v)).toBe(false);
      expect(el().getAttribute('data-x')).toBe('a  b');
    }
    render(view(''), container);
    expect(el().getAttribute('title')).toBe('');
    render(view(false), container);
    expect(el().getAttribute('title')).toBe('false');
    render(view(0), container);
    expect(el().getAttribute('title')).toBe('0');
    expect(codes()).toEqual([]);
  });
  it('functions, symbols, and plain objects are reported and remove the attribute', () => {
    render(view('x'), container);
    render(
      view(() => 'x'),
      container,
    );
    expect(el().hasAttribute('title')).toBe(false);
    render(view('x'), container);
    render(view({ a: 1 }), container);
    expect(el().hasAttribute('title')).toBe(false);
    render(view('x'), container);
    render(view(Symbol('s')), container);
    expect(el().hasAttribute('title')).toBe(false);
    render(view('x'), container);
    render(view(Object.create(null)), container);
    expect(el().hasAttribute('title')).toBe(false);
    expect(el().getAttribute('data-x')).toBe('a  b');
    expect(codes()).toEqual([
      'template.value.function',
      'template.value.function',
      'template.value.object',
      'template.value.object',
      'template.value.symbol',
      'template.value.symbol',
      'template.value.object',
      'template.value.object',
    ]);
  });
  it('arrays and objects with their own string form are written as their text', () => {
    render(view(['a', 'b']), container);
    expect(el().getAttribute('title')).toBe('a,b');
    render(view(new URL('https://example.com/')), container);
    expect(el().getAttribute('title')).toBe('https://example.com/');
    expect(codes()).toEqual([]);
  });
});

describe('binding-value matrix: boolean attribute position', () => {
  const view = (v: unknown) => html`<p ?hidden=${v}></p>`;
  it('truthy values add the attribute (empty); falsy values remove it', () => {
    for (const [v, present] of [
      [true, true],
      ['', false],
      ['x', true],
      [0, false],
      [1, true],
      [null, false],
      [undefined, false],
      [NaN, false],
    ] as const) {
      render(view(v), container);
      expect(el().hasAttribute('hidden'), String(v)).toBe(present);
      if (present) expect(el().getAttribute('hidden')).toBe('');
    }
    expect(codes()).toEqual([]);
  });
  it('functions are reported and remove the attribute (a function is always truthy)', () => {
    render(view(true), container);
    render(
      view(() => false),
      container,
    );
    expect(el().hasAttribute('hidden')).toBe(false);
    expect(codes()).toEqual(['template.value.function']);
  });
});

describe('binding-value matrix: property position', () => {
  it('assigns any value as is: undefined, null, objects, and functions (callbacks)', () => {
    const view = (v: unknown) => html`<p .custom=${v}></p>`;
    const fn = () => 1;
    const object = { a: 1 };
    for (const v of [undefined, null, '', 0, false, object, fn]) {
      render(view(v), container);
      expect((el() as unknown as { custom: unknown }).custom).toBe(v);
    }
    expect(codes()).toEqual([]);
  });
  it('writes again only when the value changes (Object.is)', () => {
    const bind = (v: unknown) => html`<i .x=${v}></i>`;
    render(bind(1), container);
    const writes: unknown[] = [];
    Object.defineProperty(el('i'), 'x', { set: (v) => writes.push(v), configurable: true });
    render(bind(1), container);
    render(bind(NaN), container);
    render(bind(NaN), container);
    render(bind(-0), container);
    expect(writes).toEqual([NaN, -0]);
  });
});

describe('binding-value matrix: classes, styles, and SVG', () => {
  it('a class attribute binding writes text; classMap toggles only its own classes', () => {
    render(html`<p class="a ${'b'}"></p>`, container);
    expect(el().className).toBe('a b');
    const on = signal(true);
    render(html`<i class=${classMap({ x: on, y: false })}></i>`, container);
    const i = el('i');
    i.classList.add('external');
    expect([...i.classList].sort()).toEqual(['external', 'x']);
    on.value = false;
    flush();
    expect([...i.classList]).toEqual(['external']);
  });
  it('a style attribute binding writes text; styleMap writes through the CSSOM', () => {
    render(html`<i style=${styleMap({ color: 'red', '--k': '1px' })}></i>`, container);
    const i = el('i');
    expect(i.style.color).toBe('red');
    expect(i.style.getPropertyValue('--k')).toBe('1px');
  });
  it('SVG attributes follow the attribute rules', () => {
    const view = (v: unknown) => html`<svg>${svg`<circle r=${v}></circle>`}</svg>`;
    render(view(4), container);
    const circle = el('circle');
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.getAttribute('r')).toBe('4');
    render(view(null), container);
    expect(circle.hasAttribute('r')).toBe(false);
  });
});

describe('node ownership', () => {
  it('a node bound in a second place moves there; the first part no longer removes it', () => {
    const node = document.createElement('b');
    const view = (a: unknown, b: unknown) =>
      html`<p id="a">${a}</p>
        <p id="b">${b}</p>`;
    render(view(node, null), container);
    expect(node.parentElement?.id).toBe('a');
    render(view(node, node), container);
    expect(node.parentElement?.id).toBe('b');
    render(view(null, node), container);
    expect(node.parentElement?.id).toBe('b');
    expect(nodes(el('#a')).length).toBe(0);
  });
  it('a node moved away by the page stays where the page put it when its part clears', () => {
    const node = document.createElement('b');
    const view = (a: unknown) => html`<p>${a}</p>`;
    render(view(node), container);
    const elsewhere = document.createElement('div');
    container.append(elsewhere);
    elsewhere.append(node);
    render(view(null), container);
    expect(node.parentNode).toBe(elsewhere);
  });
  it('a root part leaves a node the page moved to the end of another parent', () => {
    const node = document.createElement('b');
    const root = document.createElement('div');
    container.append(root);
    render(node, root);
    const elsewhere = document.createElement('div');
    container.append(elsewhere);
    elsewhere.append(node);
    render(null, root);
    expect(node.parentNode).toBe(elsewhere);
  });
  it('committing the same node again after the page moved it puts it back', () => {
    const node = document.createElement('b');
    const view = (a: unknown) => html`<p>${a}</p>`;
    render(view(node), container);
    container.append(node);
    render(view(node), container);
    expect(node.parentElement).toBe(el());
  });
  it('swapping two nodes in an unkeyed list keeps both', () => {
    const [a, b] = [document.createElement('a'), document.createElement('b')];
    const view = (items: Node[]) => html`<p>${items}</p>`;
    render(view([a, b]), container);
    render(view([b, a]), container);
    expect(nodes(el()).map((n) => n.nodeName)).toEqual(['B', 'A']);
  });
  it('one template result rendered in two places makes two independent instances', () => {
    const shared = html`<em>shared</em>`;
    render(
      html`<p id="a">${shared}</p>
        <p id="b">${shared}</p>`,
      container,
    );
    const ems = container.querySelectorAll('em');
    expect(ems).toHaveLength(2);
    expect(ems[0]).not.toBe(ems[1]);
  });
});
