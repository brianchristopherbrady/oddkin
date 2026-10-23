/**
 * `@oddkin/ai/announce` — one announcer for a surface that is not inside `odd-conversation`
 * (an agent panel, an editor). It owns one polite and one assertive live region, routes the
 * `odd-announce` events of descendants to them, and announces each key once.
 * DOM is used only when called.
 */
import { LiveAnnouncer, createLiveRegions } from '@oddkin/core/controllers/announce';
import { createScope } from '@oddkin/core/scope';
import type { AnnounceDetail } from './events.js';

export interface Announcer {
  announce(detail: AnnounceDetail): void;
  /** Forget announced keys (e.g. after switching documents). */
  reset(): void;
  /** Remove the live regions and stop routing. */
  dispose(): void;
}

/** Create the live regions inside `container` and route its descendants' announcements. */
export function createAnnouncer(container: HTMLElement): Announcer {
  const scope = createScope({ name: 'announcer' });
  const regions = createLiveRegions(container);
  scope.add(() => regions.remove(), 'live regions');
  const announcer = scope.use(
    new LiveAnnouncer({ regions: () => regions, event: 'odd-announce', target: () => container }),
  );
  return {
    announce: (detail) => announcer.announce(detail),
    reset: () => announcer.reset(),
    dispose: () => scope.dispose(),
  };
}
