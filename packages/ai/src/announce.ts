/**
 * `@oddkin/ai/announce` — one announcer for a surface that is not inside `odd-conversation`
 * (an agent panel, an editor). It owns one polite and one assertive live region, routes the
 * `ai-announce` events of descendants to them, and announces each key once.
 * DOM is used only when called.
 */
import type { AnnounceDetail } from './events.js';
import { LiveAnnouncer, routeAnnouncements } from './internal/announce.js';

export interface Announcer {
  announce(detail: AnnounceDetail): void;
  /** Forget announced keys (e.g. after switching documents). */
  reset(): void;
  /** Remove the live regions and stop routing. */
  dispose(): void;
}

function region(doc: Document, live: 'polite' | 'assertive'): HTMLElement {
  const el = doc.createElement('div');
  if (live === 'polite') el.setAttribute('role', 'status');
  el.setAttribute('aria-live', live);
  el.setAttribute('aria-atomic', 'true');
  // Visually hidden through the CSSOM (allowed under a strict style-src).
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  return el;
}

/** Create the live regions inside `container` and route its descendants' announcements. */
export function createAnnouncer(container: HTMLElement): Announcer {
  const polite = region(container.ownerDocument, 'polite');
  const assertive = region(container.ownerDocument, 'assertive');
  container.append(polite, assertive);
  const announcer = new LiveAnnouncer(polite, assertive);
  const release = routeAnnouncements(container, announcer);
  return {
    announce: (detail) => announcer.announce(detail),
    reset: () => announcer.reset(),
    dispose() {
      release();
      announcer.dispose();
      polite.remove();
      assertive.remove();
    },
  };
}
