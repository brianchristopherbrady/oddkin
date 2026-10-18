// Browser benchmark module (bundled by research/benchmarks/run.mjs). Each function performs one
// measured operation and returns elapsed milliseconds from performance.now(); setup is untimed.
import {
  OddkinElement,
  define,
  flush,
  html,
  render,
  repeat,
  scopeStats,
  signal,
} from '@oddkin/core';
import { collection } from '@oddkin/core/collections';

class BenchDirect extends OddkinElement {
  readonly count = signal(0);
  protected override render() {
    return html`<button type="button">${this.count}</button>`;
  }
}
class BenchTracked extends OddkinElement {
  readonly count = signal(0);
  protected override render() {
    return html`<button type="button">${this.count.value}</button>`;
  }
}
define('bench-direct', BenchDirect);
define('bench-tracked', BenchTracked);

interface Item {
  readonly id: string;
  readonly label: string;
}
const host = document.getElementById('host') as HTMLElement;
const time = (fn: () => void) => {
  const start = performance.now();
  fn();
  flush();
  return performance.now() - start;
};

type List = { set(items: readonly Item[]): void; items: readonly Item[] };
let lists: List[] = [];
const makeItems = (n: number, prefix = 'item') =>
  Array.from({ length: n }, (_, i) => ({ id: `k${i}`, label: `${prefix} ${i}` }));

const bench = {
  reset() {
    render(null, host);
    host.replaceChildren();
    lists = [];
    flush();
  },
  /** Connect and first-render n elements. */
  mount(tag: 'bench-direct' | 'bench-tracked', n: number) {
    bench.reset();
    return time(() => {
      for (let i = 0; i < n; i++) host.append(document.createElement(tag));
    });
  },
  unmount() {
    return time(() => host.replaceChildren());
  },
  /** Increment every mounted counter, then flush once. */
  updateAll() {
    const elements = [...host.children] as Array<BenchDirect | BenchTracked>;
    return time(() => {
      for (const el of elements) el.count.value++;
    });
  },
  /** Increment one counter among many and flush; mean of `repeat` rounds (coarse timers). */
  updateOne(repeat = 100) {
    const el = host.firstElementChild as BenchDirect | BenchTracked;
    const start = performance.now();
    for (let i = 0; i < repeat; i++) {
      el.count.value++;
      flush();
    }
    return (performance.now() - start) / repeat;
  },
  /**
   * Render `copies` independent keyed lists of n items each: through a collection, or a
   * handwritten repeat over an array signal. Copies keep timed regions above timer resolution.
   */
  setupList(kind: 'collection' | 'handwritten', n: number, copies = 1) {
    bench.reset();
    for (let copy = 0; copy < copies; copy++) {
      const container = document.createElement('div');
      host.append(container);
      const items = makeItems(n);
      if (kind === 'collection') {
        const c = collection<Item>({ key: (item) => item.id });
        c.set(items);
        render(
          html`<ul>
            ${repeat(
              c.flat,
              (e) => e.key,
              (e) => html`<li>${e.item.label}</li>`,
            )}
          </ul>`,
          container,
        );
        lists.push({
          items,
          set(next) {
            this.items = next;
            c.set(next);
          },
        });
      } else {
        const source = signal<readonly Item[]>(items);
        render(
          html`<ul>
            ${repeat(
              source,
              (item) => item.id,
              (item) => html`<li>${item.label}</li>`,
            )}
          </ul>`,
          container,
        );
        lists.push({
          items,
          set(next) {
            this.items = next;
            source.value = next;
          },
        });
      }
    }
    flush();
  },
  listOp(op: 'replace' | 'edit' | 'insert' | 'remove' | 'reverse') {
    const nexts = lists.map((current) => {
      const items = current.items;
      const middle = items.length >> 1;
      return op === 'replace'
        ? items.map((item) => ({ id: item.id, label: `${item.label}*` }))
        : op === 'edit'
          ? items.map((item, i) => (i === middle ? { id: item.id, label: 'edited' } : item))
          : op === 'insert'
            ? [...items.slice(0, middle), { id: 'new', label: 'new' }, ...items.slice(middle)]
            : op === 'remove'
              ? items.filter((_, i) => i !== middle)
              : [...items].reverse();
    });
    return (
      time(() => lists.forEach((current, i) => current.set(nexts[i] as readonly Item[]))) /
      lists.length
    );
  },
  /** Live scopes, listeners, timers, and effects owned through Scope (exact leak accounting). */
  owned() {
    return scopeStats();
  },
  /** `cycles` rounds of mounting and removing n counters. */
  cycle(n: number, cycles: number) {
    for (let i = 0; i < cycles; i++) {
      for (let j = 0; j < n; j++) host.append(document.createElement('bench-direct'));
      flush();
      host.replaceChildren();
      flush();
    }
  },
  /** Sanity check used by the runner: the DOM reflects the last operation. */
  listText() {
    return [...(host.querySelector('ul') as HTMLElement).querySelectorAll('li')].map(
      (li) => li.textContent,
    );
  },
};

(globalThis as unknown as { bench: typeof bench }).bench = bench;
