/**
 * `@oddkin/core/controllers/focus` — roving focus for composite widgets (toolbars, tab lists,
 * listboxes, grids of one dimension) and focus recovery when a focused control disappears.
 * Unbranded and `Scope`-owned; the DOM is touched only after `connect()`.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Scope } from '../scope/index.js';

export type Orientation = 'horizontal' | 'vertical' | 'both';

export interface RovingFocusOptions {
  /** Element that receives the key events, usually the widget container. */
  readonly target: () => EventTarget | null | undefined;
  /** The items in order; read on every key press, so it may change between presses. */
  readonly items: () => readonly HTMLElement[];
  /** Which arrow keys move. Default `'horizontal'`. */
  readonly orientation?: Orientation;
  /** Move from the last item to the first and back. Default `true`. */
  readonly wrap?: boolean;
  /** Home and End move to the first and last item. Default `true`. */
  readonly homeEnd?: boolean;
  /** Items to skip. Default: `disabled`, `aria-disabled="true"`, or not rendered. */
  readonly skip?: (item: HTMLElement) => boolean;
  /**
   * Called when the active item changes (keyboard, focus, or `setActive`). Without it the
   * controller writes `tabindex` itself: `0` on the active item, `-1` on the others.
   */
  readonly onActiveChange?: (index: number, item: HTMLElement) => void;
}

const defaultSkip = (item: HTMLElement): boolean =>
  (item as { disabled?: boolean }).disabled === true ||
  item.getAttribute('aria-disabled') === 'true' ||
  !item.checkVisibility();

/**
 * WAI-ARIA roving tabindex: one item is in the Tab order; arrow keys (mirrored in
 * right-to-left text for horizontal movement), Home, and End move focus among the others.
 */
export class RovingFocus implements Controller {
  readonly #options: RovingFocusOptions;
  #active = 0;

  constructor(options: RovingFocusOptions) {
    this.#options = options;
  }

  /** Index of the item that holds the Tab stop. */
  get activeIndex(): number {
    return this.#active;
  }

  connect(scope: Scope): void {
    const target = this.#options.target();
    if (!target) return;
    scope.listen(target, 'keydown', (event: KeyboardEvent) => this.#onKey(event));
    // Focus arriving by pointer or programmatically makes that item the Tab stop.
    scope.listen(target, 'focusin', (event: FocusEvent) => {
      const items = this.#options.items();
      const index = items.findIndex((item) => event.composedPath().includes(item));
      if (index >= 0 && index !== this.#active) this.#set(index, items, false);
    });
    this.sync();
  }

  /** Make `index` the Tab stop, optionally focusing it. Skipped items are not selected. */
  setActive(index: number, options: { focus?: boolean } = {}): void {
    const items = this.#options.items();
    const item = items[index];
    if (!item || this.#skip(item)) return;
    this.#set(index, items, options.focus ?? false);
  }

  /** Re-apply the Tab stop after items change; moves it to the first usable item if needed. */
  sync(): void {
    const items = this.#options.items();
    if (!items.length) return;
    let index = this.#active;
    const current = items[index];
    if (!current || this.#skip(current)) index = items.findIndex((item) => !this.#skip(item));
    if (index < 0) return;
    this.#active = index;
    this.#apply(items);
  }

  #skip(item: HTMLElement): boolean {
    return (this.#options.skip ?? defaultSkip)(item);
  }

  #set(index: number, items: readonly HTMLElement[], focus: boolean): void {
    this.#active = index;
    this.#apply(items);
    if (focus) items[index]?.focus();
  }

  #apply(items: readonly HTMLElement[]): void {
    const item = items[this.#active] as HTMLElement;
    if (this.#options.onActiveChange) this.#options.onActiveChange(this.#active, item);
    else items.forEach((each, i) => (each.tabIndex = i === this.#active ? 0 : -1));
  }

  #onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const orientation = this.#options.orientation ?? 'horizontal';
    const horizontal = orientation !== 'vertical';
    const vertical = orientation !== 'horizontal';
    const target = event.currentTarget;
    const element = target instanceof ShadowRoot ? target.host : target;
    const rtl =
      horizontal && element instanceof Element
        ? getComputedStyle(element).direction === 'rtl'
        : false;
    let step: 1 | -1 | 'first' | 'last';
    switch (event.key) {
      case 'ArrowRight':
        if (!horizontal) return;
        step = rtl ? -1 : 1;
        break;
      case 'ArrowLeft':
        if (!horizontal) return;
        step = rtl ? 1 : -1;
        break;
      case 'ArrowDown':
        if (!vertical) return;
        step = 1;
        break;
      case 'ArrowUp':
        if (!vertical) return;
        step = -1;
        break;
      case 'Home':
        if (this.#options.homeEnd === false) return;
        step = 'first';
        break;
      case 'End':
        if (this.#options.homeEnd === false) return;
        step = 'last';
        break;
      default:
        return;
    }
    const items = this.#options.items();
    const next = this.#find(items, step);
    if (next === undefined) return;
    event.preventDefault();
    this.#set(next, items, true);
  }

  #find(items: readonly HTMLElement[], step: 1 | -1 | 'first' | 'last'): number | undefined {
    const count = items.length;
    if (!count) return undefined;
    const usable = (i: number) => !this.#skip(items[i] as HTMLElement);
    if (step === 'first' || step === 'last') {
      const order = [...items.keys()];
      if (step === 'last') order.reverse();
      return order.find(usable);
    }
    const wrap = this.#options.wrap ?? true;
    for (let n = 1; n < count; n++) {
      let i = this.#active + step * n;
      if (wrap) i = (i + count) % count;
      else if (i < 0 || i >= count) return undefined;
      if (usable(i)) return i;
    }
    return undefined;
  }
}

export interface FocusRecoveryOptions {
  /** The subtree to watch, usually the shadow root. */
  readonly root: () => ShadowRoot | HTMLElement | null | undefined;
  /** Where focus goes when the focused element disappears; made focusable if needed. */
  readonly fallback: () => HTMLElement | null | undefined;
}

/**
 * Moves focus to a fallback when the focused element inside `root` is removed, hidden,
 * disabled, or made inert, so keyboard users keep their place instead of landing on the
 * document body. Watches only while focus is inside `root`; never moves focus otherwise.
 */
export class FocusRecovery implements Controller {
  readonly #options: FocusRecoveryOptions;
  #last: HTMLElement | undefined;
  #observer: MutationObserver | undefined;

  constructor(options: FocusRecoveryOptions) {
    this.#options = options;
  }

  connect(scope: Scope): void {
    const root = this.#options.root();
    if (!root) return;
    scope.listen(root, 'focusin', (event: FocusEvent) => {
      this.#last = event.composedPath()[0] as HTMLElement;
      if (this.#observer) return;
      this.#observer = new MutationObserver(() => this.recover());
      this.#observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'disabled', 'inert', 'aria-disabled'],
      });
    });
    // Focus leaving for another element is the user's choice; stop watching. `relatedTarget` is
    // retargeted to this tree, so focus moving into a nested shadow root still counts as inside.
    scope.listen(root, 'focusout', (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && !root.contains(next)) this.#stop();
    });
    scope.add(() => this.#stop(), 'focus recovery');
  }

  /** Check now (also runs automatically after mutations while focus is inside `root`). */
  recover(): void {
    const last = this.#last;
    const root = this.#options.root();
    if (!last || !root || focusable(last)) return;
    const doc = root.ownerDocument;
    const active = doc.activeElement;
    // Lost: removed (the document falls back to body) or still pointing at a hidden element
    // (through open roots, or this root when it is closed).
    const lost =
      !active ||
      active === doc.body ||
      deepActive(doc) === last ||
      (root as Partial<ShadowRoot>).activeElement === last;
    if (!lost) return this.#stop();
    const fallback = this.#options.fallback();
    if (!fallback || !focusable(fallback)) return;
    // Elements that are not focusable by default (status text) become programmatically focusable.
    if (fallback.tabIndex < 0 && !fallback.hasAttribute('tabindex')) fallback.tabIndex = -1;
    this.#last = fallback;
    fallback.focus({ preventScroll: true });
  }

  #stop(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#last = undefined;
  }
}

function focusable(el: HTMLElement): boolean {
  if (!el.isConnected || (el as { disabled?: boolean }).disabled === true) return false;
  return !el.closest('[inert]') && el.checkVisibility();
}

function deepActive(doc: Document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
