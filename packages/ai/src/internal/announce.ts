/**
 * One live-region pair per surface. Duplicate keys are announced once; messages arriving in the
 * same task are joined. The regions must exist before content changes, so elements render them
 * empty and this class only writes their text.
 */
import type { AnnounceDetail } from '../events.js';

const SETTLE_MS = 120;

export class LiveAnnouncer {
  readonly #polite: HTMLElement;
  readonly #assertive: HTMLElement;
  readonly #seen = new Set<string>();
  readonly #seenOrder: string[] = [];
  #pending: { polite: string[]; assertive: string[] } = { polite: [], assertive: [] };
  #timer: ReturnType<typeof setTimeout> | undefined;
  #disposed = false;

  constructor(polite: HTMLElement, assertive: HTMLElement) {
    this.#polite = polite;
    this.#assertive = assertive;
  }

  announce(detail: AnnounceDetail): void {
    if (this.#disposed || !detail.text) return;
    if (this.#seen.has(detail.key)) return;
    this.#seen.add(detail.key);
    this.#seenOrder.push(detail.key);
    if (this.#seenOrder.length > 500) this.#seen.delete(this.#seenOrder.shift() as string);
    this.#pending[detail.priority].push(detail.text);
    this.#timer ??= setTimeout(() => this.#flush(), SETTLE_MS);
  }

  /** Forget announced keys (e.g. after switching conversations). */
  reset(): void {
    this.#seen.clear();
    this.#seenOrder.length = 0;
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#pending = { polite: [], assertive: [] };
  }

  #flush(): void {
    this.#timer = undefined;
    const { polite, assertive } = this.#pending;
    this.#pending = { polite: [], assertive: [] };
    // Replacing the text (rather than appending) keeps each region to one current message.
    if (polite.length) this.#polite.textContent = polite.join(' ');
    if (assertive.length) this.#assertive.textContent = assertive.join(' ');
  }
}

/**
 * Route `ai-announce` events from descendants to `announcer`. The event is cancelled and
 * stopped here so an outer announcer never repeats it.
 */
export function routeAnnouncements(target: EventTarget, announcer: LiveAnnouncer): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AnnounceDetail>).detail;
    if (!detail || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    announcer.announce(detail);
  };
  target.addEventListener('ai-announce', listener);
  return () => target.removeEventListener('ai-announce', listener);
}
