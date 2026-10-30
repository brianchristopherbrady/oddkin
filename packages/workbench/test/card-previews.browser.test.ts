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
  for (let i = 0; i < 1000 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
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
    // A component without page data gets no frame, and is not asked again.
    pending.get('d')!(undefined);
    pending.get('c')!(undefined);
    await new Promise((r) => setTimeout(r, 20));
    expect(hosts.some((host) => host.querySelector('iframe'))).toBe(false);
    observer.near([hosts[0]!, false], [hosts[0]!, true]);
    await new Promise((r) => setTimeout(r, 20));
    expect(requested).toHaveLength(4);

    const late = cards.preview(entry('e')) as HTMLElement;
    cards.dispose();
    observer.near([late, true]);
    expect(requested).toHaveLength(4);
    expect(observer.observed.size).toBe(0);
    expect(cards.preview(entry('f'))).toBeUndefined();
  });

  it('keeps twelve frames, never those near the view, and loads a moved card again', async () => {
    window.IntersectionObserver = StandInObserver as unknown as typeof IntersectionObserver;
    const container = document.createElement('div');
    document.body.append(container);
    const registration = new URL('./fixtures/acme-preview-element.ts', import.meta.url).href;
    const cards = cardPreviews({
      document,
      frameUrl: new URL('./fixtures/frame-test.html', import.meta.url).href,
      page: async (id) => ({
        format: 'oddkin.workbench-page',
        version: 1,
        id,
        kind: 'component',
        tag: 'acme-button',
        package: '@acme/ui',
        module: 'button.js',
        declaration: {},
        examples: [],
        registration,
      }),
    });
    try {
      const hosts = Array.from(
        { length: 14 },
        (_, i) => cards.preview(entry(`c${i}`)) as HTMLElement,
      );
      container.append(...hosts);
      const frame = (i: number) => hosts[i]!.querySelector('iframe');
      const shown = (i: number) =>
        !!frame(i)?.contentDocument?.querySelector('acme-button')?.shadowRoot;
      const observer = StandInObserver.last;
      // Fourteen cards near the view: every one gets a frame, past the twelve kept.
      observer.near(...hosts.map((host): [Element, boolean] => [host, true]));
      await until(() => hosts.every((_, i) => shown(i)), 'every card preview');

      // Six leave the view: the two out of view longest are released.
      observer.near(...hosts.slice(0, 6).map((host): [Element, boolean] => [host, false]));
      expect(hosts.map((_, i) => !!frame(i))).toEqual([
        ...[false, false],
        ...Array<boolean>(12).fill(true),
      ]);
      // The third comes near and leaves again: of the cards out of view, it is now the latest.
      observer.near([hosts[2]!, true]);
      observer.near([hosts[2]!, false]);
      // The first comes back and loads again; the card out of view longest goes (the fourth).
      observer.near([hosts[0]!, true]);
      await until(() => shown(0), 'the card that came back');
      expect(frame(3)).toBeNull();
      expect(frame(2)).not.toBeNull();
      expect(container.querySelectorAll('iframe')).toHaveLength(12);

      // Moving a card (a filter took it out and back) reloads its frame's document: it loads again.
      const moved = frame(13);
      container.prepend(hosts[13]!);
      await until(() => frame(13) !== moved && shown(13), 'the moved card');

      cards.dispose();
      expect(container.querySelectorAll('iframe')).toHaveLength(0);
    } finally {
      cards.dispose();
      container.remove();
    }
  });
});
