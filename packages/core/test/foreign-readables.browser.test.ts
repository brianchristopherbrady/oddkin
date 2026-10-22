import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setErrorHandler, type ErrorContext } from '../src/diagnostics/index.js';
import { classMap } from '../src/helpers/class-map.js';
import { live } from '../src/helpers/live.js';
import { styleMap } from '../src/helpers/style-map.js';
import { READABLE } from '../src/reactive/graph.js';
import { flush, fromExternal, signal, toExternal, type Readable } from '../src/reactive/index.js';
import { html, match, render, repeat, when } from '../src/template/index.js';

/** A readable from another copy of @oddkin/core: the shared brand and public protocol, its own graph. */
function foreign<T>(initial: T) {
  let current = initial;
  const listeners = new Set<(value: T) => void>();
  const readable = {
    [READABLE]: true as const,
    get value() {
      return current;
    },
    peek: () => current,
    subscribe: (onChange: (value: T) => void) => {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
  } satisfies Readable<T>;
  const set = (next: T) => {
    current = next;
    for (const listener of [...listeners]) listener(next);
    flush();
  };
  return { readable, set, listeners: () => listeners.size };
}

let reported: ErrorContext[];
let container: HTMLElement;
const foreignReports = () => reported.filter((c) => c.code === 'reactive.readable.foreign').length;

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

const views: [string, unknown, (r: Readable<never>) => unknown][] = [
  ['classMap', true, (r) => html`<p class=${classMap({ on: r })}></p>`],
  ['styleMap', 'red', (r) => html`<p style=${styleMap({ color: r })}></p>`],
  ['live', 'a', (r) => html`<input .value=${live(r)} />`],
  ['when', true, (r) => html`<p>${when(r, () => 'yes')}</p>`],
  ['match', 'a', (r) => html`<p>${match(r as Readable<'a'>, { a: () => 'a' })}</p>`],
  [
    'repeat',
    ['a'],
    (r) =>
      html`<ul>
        ${repeat(
          r as Readable<string[]>,
          (item) => item,
          (item) => html`<li>${item}</li>`,
        )}
      </ul>`,
  ],
];

describe('readables from another copy of core (core-contracts §5.1)', () => {
  it('are reported once where a template binds them, and keep their first value', () => {
    const count = foreign(1);
    const view = () =>
      html`<output data-count="n${count.readable}">${count.readable}</output>
        <p>${count.readable}</p>`;
    render(view(), container);
    render(view(), container);
    expect(foreignReports()).toBe(1);
    count.set(2);
    const output = container.querySelector('output') as HTMLOutputElement;
    expect([output.textContent, output.dataset['count']]).toEqual(['1', 'n1']);
  });

  it('are reported in a child binding', () => {
    render(html`<p>${foreign('a').readable}</p>`, container);
    expect(foreignReports()).toBe(1);
  });

  it('are reported in an attribute binding', () => {
    render(html`<p title="t${foreign('a').readable}"></p>`, container);
    expect(foreignReports()).toBe(1);
  });

  it.each(views)('are reported by %s', (_name, initial, view) => {
    render(view(foreign(initial).readable as Readable<never>), container);
    expect(foreignReports()).toBe(1);
  });

  it('bridged with fromExternal(toExternal(readable)), stay live without a report', () => {
    const count = foreign(1);
    const bridged = fromExternal(toExternal(count.readable));
    const root = render(html`<p class=${classMap({ odd: bridged })}>${bridged}</p>`, container);
    const p = container.querySelector('p') as HTMLElement;
    count.set(4);
    expect([p.textContent, p.classList.contains('odd')]).toEqual(['4', true]);
    expect(foreignReports()).toBe(0);
    root.dispose();
    expect(count.listeners()).toBe(0);
  });

  it('leave readables of this copy unreported', () => {
    const local = signal(1);
    render(
      html`<p class=${classMap({ on: local })} title="t${local}">
        ${when(local, () => 'x')}${local}
      </p>`,
      container,
    );
    expect(foreignReports()).toBe(0);
  });
});
