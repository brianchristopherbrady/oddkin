import { afterEach, describe, expect, it } from 'vitest';
import { cardPreviews } from '../src/app/card-previews.js';
import type { ComponentPageData } from '../src/data/index.js';
import type { PageEntry } from '../src/pages/index.js';

// The catalog cards' load queue, with a stand-in IntersectionObserver that the test drives.
// Mounting a card's example in a real frame is covered by the shell's tests.

class StandInObserver {
  static last: StandInObserver;
  readonly observed = new Set<Element>();
  constructor(readonly callback: IntersectionObserverCallback) {
    StandInObserver.last = this;
  }
  observe(target: Element) {
    this.observed.add(target);
  }
  unobserve(target: Element) {
    this.observed.delete(target);
  }
  disconnect() {
    this.observed.clear();
  }
  /** Report each target as near the view or not. */
  near(...targets: [Element, boolean][]) {
    this.callback(
      targets.map(
        ([target, isIntersecting]) => ({ target, isIntersecting }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

const original = window.IntersectionObserver;
afterEach(() => {
  window.IntersectionObserver = original;
});

async function until(check: () => boolean, what: string) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  if (!check()) throw new Error(`timed out waiting for ${what}`);
}

const entry = (id: string, kind: PageEntry['kind'] = 'component') =>
  ({ id, kind, title: id }) as PageEntry;

describe('catalog card previews', () => {
  it('loads two at a time, cards near the view first, and stops when disposed', async () => {
    window.IntersectionObserver = StandInObserver as unknown as typeof IntersectionObserver;
    const requested: string[] = [];
    const pending = new Map<string, (page: ComponentPageData | undefined) => void>();
    const cards = cardPreviews({
      document,
      frameUrl: 'about:blank',
      page: (id) => {
        requested.push(id);
        return new Promise((resolve) => pending.set(id, resolve));
      },
    });
    const hosts = ['a', 'b', 'c', 'd'].map((id) => cards.preview(entry(id)) as HTMLElement);
    // The same node for the same page; inert, so the card's link stays its only stop.
    expect(cards.preview(entry('a'))).toBe(hosts[0]);
    expect(hosts.every((host) => host.inert && host.className === 'wb-card-frame')).toBe(true);
    expect(cards.preview(entry('foundations/color', 'foundation'))).toBeUndefined();
    const observer = StandInObserver.last;
    expect(observer.observed.size).toBe(4);

    observer.near(...hosts.map((host): [Element, boolean] => [host, true]));
    expect(requested).toEqual(['a', 'b']);
    // c is scrolled past before its turn, so d goes next.
    observer.near([hosts[2]!, false]);
    pending.get('a')!(undefined);
    await until(() => requested.length === 3, 'the next card');
    expect(requested).toEqual(['a', 'b', 'd']);
    // c comes back and waits for a free slot.
    observer.near([hosts[2]!, true]);
    expect(requested).toEqual(['a', 'b', 'd']);
    pending.get('b')!(undefined);
    await until(() => requested.length === 4, 'the card that came back');
    expect(requested).toEqual(['a', 'b', 'd', 'c']);
    // A started card is no longer watched; a component without page data gets no frame.
    expect(observer.observed.size).toBe(0);
    pending.get('d')!(undefined);
    pending.get('c')!(undefined);
    await new Promise((r) => setTimeout(r, 20));
    expect(hosts.some((host) => host.querySelector('iframe'))).toBe(false);

    const late = cards.preview(entry('e')) as HTMLElement;
    cards.dispose();
    observer.near([late, true]);
    expect(requested).toHaveLength(4);
    expect(observer.observed.size).toBe(0);
    expect(cards.preview(entry('f'))).toBeUndefined();
  });
});
