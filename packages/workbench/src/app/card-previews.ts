/**
 * Live previews for the shell's catalog cards. The shell registers no library element in its own
 * realm, so each card shows its component's first example in a preview frame, created when the
 * card nears the view and loaded two at a time (a card scrolled past before its turn waits until
 * it comes back); the card's link stays its only stop. Frames are bounded: past `KEPT`, the frames
 * of the cards longest out of view are released and load again when their cards come back, as a
 * frame does whose card a filter took out and back (moving a frame reloads its document).
 */
import { createScope } from '@oddkin/core/scope';
import type { ComponentPageData } from '../data/types.js';
import type { PageEntry } from '../pages/types.js';
import { initialState, presets, registrationOf } from '../panels/model.js';
import { createIsolatedPreview, type IsolatedPreview } from '../preview/frame.js';

export interface CardPreviews {
  /** The card's preview host: the same node for the same page. */
  preview(entry: PageEntry): Node | undefined;
  dispose(): void;
}

const LOADING = 2;
/** Frames kept in all; the frames of cards near the view are never released. */
const KEPT = 12;

export function cardPreviews(options: {
  readonly document: Document;
  readonly frameUrl: string;
  /** The component page's data, or `undefined` when it has none. */
  readonly page: (id: string, signal: AbortSignal) => Promise<ComponentPageData | undefined>;
}): CardPreviews {
  const { document: doc, frameUrl } = options;
  const scope = createScope({ name: 'workbench-card-previews' });
  const hosts = new Map<string, HTMLElement>();
  const loads = new Map<Element, () => Promise<void>>();
  /** Hosts whose load has started: loading, showing a frame, or with nothing to show. */
  const started = new Set<Element>();
  /** Frames by host, the card that came near the view longest ago first. */
  const frames = new Map<Element, IsolatedPreview>();
  const near = new Set<Element>();
  /** Hosts near the view that have not started, in the order they came near. */
  const queue: Element[] = [];
  let loading = 0;
  const release = (host: Element) => {
    frames.get(host)?.dispose();
    frames.delete(host);
    started.delete(host);
  };
  const trim = () => {
    for (const host of [...frames.keys()]) {
      if (frames.size <= KEPT) return;
      if (!near.has(host)) release(host);
    }
  };
  const next = () => {
    while (loading < LOADING && queue.length && !scope.disposed) {
      const host = queue.shift() as Element;
      started.add(host);
      loading++;
      void (loads.get(host) as () => Promise<void>)()
        .catch(() => {})
        .finally(() => {
          loading--;
          next();
        });
    }
  };
  const observer = new IntersectionObserver(
    (records) => {
      for (const { target, isIntersecting } of records) {
        const at = queue.indexOf(target);
        if (isIntersecting) {
          near.add(target);
          const frame = frames.get(target);
          if (frame) {
            // Most recently near the view: the last to be released.
            frames.delete(target);
            frames.set(target, frame);
          } else if (!started.has(target) && at < 0) queue.push(target);
        } else {
          near.delete(target);
          if (at >= 0) queue.splice(at, 1);
        }
      }
      trim();
      next();
    },
    { rootMargin: '200px' },
  );
  scope.add(() => {
    observer.disconnect();
    for (const frame of frames.values()) frame.dispose();
    frames.clear();
  }, 'card previews');

  const load = (host: HTMLElement, entry: PageEntry) => async () => {
    const page = await options.page(entry.id, scope.signal);
    const registration = page && registrationOf(page);
    // Released while its page data loaded: it starts again when its card comes back.
    if (!page || registration === undefined || scope.disposed || !started.has(host)) return;
    const state = initialState(page);
    const fixture = presets(page).some((p) => p.name === state.preset && p.fixture);
    const preview = createIsolatedPreview({
      document: doc,
      container: host,
      frameUrl,
      title: `${entry.title} preview`,
    });
    frames.set(host, preview);
    trim();
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
    // Moving a frame (a filter took its card out and back) loads a new, empty document.
    const mounted = preview.iframe.contentDocument;
    preview.iframe.addEventListener('load', () => {
      if (frames.get(host) !== preview || preview.iframe.contentDocument === mounted) return;
      release(host);
      if (near.has(host)) queue.push(host);
      next();
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
        loads.set(host, load(host, entry));
        observer.observe(host);
      }
      return host;
    },
    dispose: () => scope.dispose(),
  };
}
