/**
 * `@oddkin/core/controllers/announce` — one polite and one assertive live region for a surface.
 * Each key is announced once; messages that arrive close together are joined. Descendants can
 * request announcements with a caller-named event, which the nearest announcer handles and
 * cancels so overlapping announcers stay silent. Unbranded and `Scope`-owned.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Scope } from '../scope/index.js';

export type Politeness = 'polite' | 'assertive';

export interface Announcement {
  readonly text: string;
  /** Announced once per key until `reset()`. Default: the text. */
  readonly key?: string;
  /** Default `'polite'`. Use `'assertive'` only for failures that need immediate attention. */
  readonly priority?: Politeness;
}

export interface LiveRegions {
  readonly polite: HTMLElement;
  readonly assertive: HTMLElement;
}

export interface AnnouncerOptions {
  /**
   * Empty live regions that exist before any content changes (some screen readers ignore
   * regions inserted together with their first message): rendered by the element's template,
   * or created with `createLiveRegions()`.
   */
  readonly regions: () => LiveRegions | null | undefined;
  /** Event name whose `detail` is an `Announcement`, routed from descendants of `target`. */
  readonly event?: string;
  /** Where routed events are heard. */
  readonly target?: () => EventTarget | null | undefined;
  /** Milliseconds to collect messages before writing them. Default 120. */
  readonly delay?: number;
}

const REMEMBERED_KEYS = 500;

/** A visually hidden live region, styled through the CSSOM so a strict `style-src` allows it. */
export function createLiveRegion(doc: Document, politeness: Politeness): HTMLElement {
  const el = doc.createElement('div');
  if (politeness === 'polite') el.setAttribute('role', 'status');
  el.setAttribute('aria-live', politeness);
  el.setAttribute('aria-atomic', 'true');
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

/** Append a polite and an assertive region to `container`; `remove()` takes them out again. */
export function createLiveRegions(
  container: HTMLElement | ShadowRoot,
): LiveRegions & { remove(): void } {
  const doc = container.ownerDocument as Document;
  const polite = createLiveRegion(doc, 'polite');
  const assertive = createLiveRegion(doc, 'assertive');
  container.append(polite, assertive);
  return {
    polite,
    assertive,
    remove() {
      polite.remove();
      assertive.remove();
    },
  };
}

export class LiveAnnouncer implements Controller {
  readonly #options: AnnouncerOptions;
  readonly #seen = new Set<string>();
  #regions: LiveRegions | undefined;
  #pending: Record<Politeness, string[]> = { polite: [], assertive: [] };
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: AnnouncerOptions) {
    this.#options = options;
  }

  connect(scope: Scope): void {
    const regions = this.#options.regions();
    if (!regions) return;
    this.#regions = regions;
    scope.add(() => {
      if (this.#timer !== undefined) clearTimeout(this.#timer);
      this.#timer = undefined;
      this.#pending = { polite: [], assertive: [] };
      this.#regions = undefined;
    }, 'announcer');
    const event = this.#options.event;
    const target = this.#options.target?.();
    if (event && target)
      scope.listen(target, event, (e: CustomEvent<Announcement>) => {
        if (e.defaultPrevented || !e.detail) return;
        e.preventDefault();
        e.stopPropagation();
        this.announce(e.detail);
      });
  }

  /** Queue a message. Ignored while disconnected, when empty, or when its key was announced. */
  announce(message: Announcement): void {
    if (!this.#regions || !message.text) return;
    const key = message.key ?? message.text;
    if (this.#seen.has(key)) return;
    this.#seen.add(key);
    // Sets iterate in insertion order: drop the oldest key once the memory is full.
    if (this.#seen.size > REMEMBERED_KEYS) this.#seen.delete(this.#seen.values().next().value!);
    this.#pending[message.priority ?? 'polite'].push(message.text);
    this.#timer ??= setTimeout(() => this.#flush(), this.#options.delay ?? 120);
  }

  /** Forget announced keys, e.g. after switching documents or conversations. */
  reset(): void {
    this.#seen.clear();
  }

  #flush(): void {
    this.#timer = undefined;
    const regions = this.#regions;
    const { polite, assertive } = this.#pending;
    this.#pending = { polite: [], assertive: [] };
    if (!regions) return;
    // Replacing the text keeps each region to one current message.
    if (polite.length) regions.polite.textContent = polite.join(' ');
    if (assertive.length) regions.assertive.textContent = assertive.join(' ');
  }
}
