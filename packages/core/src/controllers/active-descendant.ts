/**
 * `@oddkin/core/controllers/active-descendant` — keyboard focus among the items of a listbox,
 * tree, grid, or combobox popup while DOM focus stays on one element (WAI-ARIA
 * `aria-activedescendant`). Unbranded and `Scope`-owned; the DOM is touched only after `connect()`.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Scope } from '../scope/index.js';

export type Orientation = 'horizontal' | 'vertical' | 'both';

export interface ActiveDescendantOptions {
  /** The element that keeps DOM focus: it receives the key events and `aria-activedescendant`. */
  readonly target: () => HTMLElement | null | undefined;
  /**
   * The items in order, in the target's tree (ID references do not cross shadow roots); read on
   * every key, so it may change between keys. Items without an `id` get one.
   */
  readonly items: () => readonly HTMLElement[];
  /** Which arrow keys move. Default `'vertical'`. */
  readonly orientation?: Orientation;
  /** Move from the last item to the first and back. Default `false`. */
  readonly wrap?: boolean;
  /** Home and End move to the first and last item. Default `true`; turn it off in a text field. */
  readonly homeEnd?: boolean;
  /** Items to skip. Default: `disabled`, `aria-disabled="true"`, or not rendered. */
  readonly skip?: (item: HTMLElement) => boolean;
  /**
   * Called when the active item changes (`index` -1: none), with the key event that moved it, so
   * a multi-select widget can extend its selection on Shift. Draw the visual focus from here.
   */
  readonly onActiveChange?: (
    index: number,
    item: HTMLElement | undefined,
    event?: KeyboardEvent,
  ) => void;
}

const defaultSkip = (item: HTMLElement): boolean =>
  (item as { disabled?: boolean }).disabled === true ||
  item.getAttribute('aria-disabled') === 'true' ||
  !item.checkVisibility();

let ids = 0;

/**
 * Arrow keys (mirrored in right-to-left text for horizontal movement), Home, and End move the
 * active item; the target's `aria-activedescendant` names it and it is scrolled into view. The
 * active item is followed by identity, so it survives reordering; `sync()` drops it when it is
 * removed or becomes unusable.
 */
export class ActiveDescendant implements Controller {
  readonly #options: ActiveDescendantOptions;
  #target: HTMLElement | undefined;
  #active: HTMLElement | undefined;

  constructor(options: ActiveDescendantOptions) {
    this.#options = options;
  }

  /** The active item, or undefined. */
  get activeItem(): HTMLElement | undefined {
    return this.#active;
  }

  /** Index of the active item among the current items, or -1. */
  get activeIndex(): number {
    return this.#active ? this.#options.items().indexOf(this.#active) : -1;
  }

  connect(scope: Scope): void {
    const target = this.#options.target();
    if (!target) return;
    this.#target = target;
    scope.listen(target, 'keydown', (event: KeyboardEvent) => this.#onKey(event));
    scope.add(() => (this.#target = undefined), 'active descendant');
    this.#write();
  }

  /**
   * Make the item at `index` active (-1: none), scrolling it into view unless `scroll` is false.
   * Skipped items are not activated.
   */
  setActive(index: number, options: { scroll?: boolean } = {}): void {
    const item = this.#options.items()[index];
    if (index >= 0 && (!item || this.#skip(item))) return;
    this.#set(item, options.scroll ?? true);
  }

  /** After the items change: drop the active item if it is gone or can no longer be used. */
  sync(): void {
    const active = this.#active;
    if (active && (!this.#options.items().includes(active) || this.#skip(active)))
      this.#set(undefined, false);
    else this.#write();
  }

  #skip(item: HTMLElement): boolean {
    return (this.#options.skip ?? defaultSkip)(item);
  }

  #set(item: HTMLElement | undefined, scroll: boolean, event?: KeyboardEvent): void {
    if (!this.#target) return;
    const changed = item !== this.#active;
    this.#active = item;
    this.#write();
    if (item && scroll) item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (changed) this.#options.onActiveChange?.(this.activeIndex, item, event);
  }

  #write(): void {
    const target = this.#target;
    const item = this.#active;
    if (!target) return;
    if (!item) return target.removeAttribute('aria-activedescendant');
    if (!item.id) item.id = `active-descendant-${++ids}`;
    target.setAttribute('aria-activedescendant', item.id);
  }

  #onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const orientation = this.#options.orientation ?? 'vertical';
    const horizontal = orientation !== 'vertical';
    const vertical = orientation !== 'horizontal';
    const rtl = horizontal && getComputedStyle(this.#target as Element).direction === 'rtl';
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
    // The key is the widget's even at either end, so the page does not scroll instead.
    event.preventDefault();
    const items = this.#options.items();
    const next = this.#find(items, step);
    if (next !== undefined) this.#set(items[next], true, event);
  }

  #find(items: readonly HTMLElement[], step: 1 | -1 | 'first' | 'last'): number | undefined {
    const count = items.length;
    const usable = (i: number) => !this.#skip(items[i] as HTMLElement);
    if (step === 'first' || step === 'last') {
      const order = [...items.keys()];
      if (step === 'last') order.reverse();
      return order.find(usable);
    }
    const current = this.#active ? items.indexOf(this.#active) : -1;
    // With nothing active, Down starts at the first item and Up at the last.
    const from = current < 0 ? (step === 1 ? -1 : count) : current;
    const wrap = this.#options.wrap ?? false;
    for (let n = 1; n <= count; n++) {
      let i = from + step * n;
      if (wrap) i = (i + count) % count;
      else if (i < 0 || i >= count) return undefined;
      if (usable(i)) return i;
    }
    return undefined;
  }
}
