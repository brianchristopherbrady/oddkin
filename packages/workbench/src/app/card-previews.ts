/**
 * Live previews for the shell's catalog cards. The shell registers no library element in its own
 * realm, so each card shows its component's first example in a preview frame, created when the
 * card nears the view and loaded two at a time (a card scrolled past before its turn waits until
 * it comes back); the card's link stays its only stop.
 */
import { createScope } from '@oddkin/core/scope';
import type { ComponentPageData } from '../data/types.js';
import type { PageEntry } from '../pages/types.js';
import { initialState, presets, registrationOf } from '../panels/model.js';
import { createIsolatedPreview } from '../preview/frame.js';

export interface CardPreviews {
  /** The card's preview host: the same node for the same page. */
  preview(entry: PageEntry): Node | undefined;
  dispose(): void;
}

const LOADING = 2;

export function cardPreviews(options: {
  readonly document: Document;
  readonly frameUrl: string;
  /** The component page's data, or `undefined` when it has none. */
  readonly page: (id: string, signal: AbortSignal) => Promise<ComponentPageData | undefined>;
}): CardPreviews {
  const { document: doc, frameUrl } = options;
  const scope = createScope({ name: 'workbench-card-previews' });
  const hosts = new Map<string, HTMLElement>();
  /** Hosts whose preview has not started, and their loads. */
  const waiting = new Map<Element, () => Promise<void>>();
  /** Waiting hosts near the view, in the order they came near: a host that leaves it drops out. */
  const queue: Element[] = [];
  let loading = 0;
  const next = () => {
    while (loading < LOADING && queue.length && !scope.disposed) {
      const host = queue.shift() as Element;
      const load = waiting.get(host) as () => Promise<void>;
      waiting.delete(host);
      observer.unobserve(host);
      loading++;
      void load()
        .catch(() => {})
        .finally(() => {
          loading--;
          next();
        });
    }
  };
  const observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (!waiting.has(record.target)) continue;
        const at = queue.indexOf(record.target);
        if (record.isIntersecting && at < 0) queue.push(record.target);
        else if (!record.isIntersecting && at >= 0) queue.splice(at, 1);
      }
      next();
    },
    { rootMargin: '200px' },
  );
  scope.add(() => observer.disconnect(), 'card preview observer');

  const load = (host: HTMLElement, entry: PageEntry) => async () => {
    const page = await options.page(entry.id, scope.signal);
    const registration = page && registrationOf(page);
    if (!page || registration === undefined || scope.disposed) return;
    const state = initialState(page);
    const fixture = presets(page).some((p) => p.name === state.preset && p.fixture);
    const preview = createIsolatedPreview({
      document: doc,
      container: host,
      frameUrl,
      title: `${entry.title} preview`,
    });
    scope.add(() => preview.dispose(), 'card preview');
    preview.iframe.style.blockSize = '100%';
    preview.iframe.tabIndex = -1;
    await preview.request('mount', {
      tag: page.tag,
      registration,
      example: `example:${page.tag}/${state.preset}`,
      properties: state.properties,
      attributes: state.attributes,
      slots: state.slots,
      styles: state.styles ?? {},
      ...(fixture && page.exampleModule ? { fixture: page.exampleModule } : {}),
    });
  };

  return {
    preview(entry) {
      if (entry.kind !== 'component' || scope.disposed) return undefined;
      let host = hosts.get(entry.id);
      if (!host) {
        host = doc.createElement('div');
        host.className = 'wb-card-frame';
        host.inert = true;
        hosts.set(entry.id, host);
        waiting.set(host, load(host, entry));
        observer.observe(host);
      }
      return host;
    },
    dispose: () => scope.dispose(),
  };
}
