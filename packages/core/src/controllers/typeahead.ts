/**
 * `@oddkin/core/controllers/typeahead` — type-to-select for listboxes, menus, trees, and grids
 * (WAI-ARIA APG): characters typed in quick succession move to the next item whose text starts
 * with them. Unbranded and `Scope`-owned; DOM-free apart from the optional key listener.
 * Contract: docs/architecture/core-contracts.md §4.1.
 */
import type { Controller, Release, Scope } from '../scope/index.js';

export interface TypeaheadOptions<T> {
  /**
   * Element that receives the key events, listened to in the capture phase so the widget's own
   * handlers see `defaultPrevented` for keys typeahead used. Omit it to call `type()` yourself.
   */
  readonly target?: () => EventTarget | null | undefined;
  /** The items in order; read on every key, so it may change between keys. */
  readonly items: () => readonly T[];
  /** Index of the current item, or -1. */
  readonly active: () => number;
  /** Called with the matching item when it is not the current one. */
  readonly onMatch: (index: number, item: T) => void;
  /** The text an item is matched by, ignoring leading white space. Default: its text content. */
  readonly text?: (item: T) => string;
  /** Items never matched. Default for elements: disabled, `aria-disabled="true"`, or not rendered. */
  readonly skip?: (item: T) => boolean;
  /** Milliseconds after the last key before the query starts again. Default 500 (APG). */
  readonly timeout?: number;
}

const defaultText = (item: unknown): string => String((item as Partial<Node>).textContent ?? item);

const defaultSkip = (item: unknown): boolean => {
  const el = item as Partial<HTMLElement> & { disabled?: boolean };
  if (typeof el.getAttribute !== 'function') return false;
  return (
    el.disabled === true || el.getAttribute('aria-disabled') === 'true' || !el.checkVisibility!()
  );
};

const editable = (node: unknown): boolean => {
  const el = node as Partial<HTMLElement>;
  return el.isContentEditable === true || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
};

/**
 * One character moves to the next item starting with it, after the current one; typing the same
 * character again cycles through those items. Several different characters match the whole query,
 * starting at the current item. Matching ignores case and accents. Space belongs to the query
 * only while one is in progress, so it still selects otherwise.
 */
export class Typeahead<T = HTMLElement> implements Controller {
  readonly #options: TypeaheadOptions<T>;
  #scope: Scope | undefined;
  #query = '';
  #clear: Release | undefined;
  #collator: Intl.Collator | undefined;

  constructor(options: TypeaheadOptions<T>) {
    this.#options = options;
  }

  /** The characters typed so far, until the timeout. */
  get query(): string {
    return this.#query;
  }

  connect(scope: Scope): void {
    this.#scope = scope;
    scope.add(() => {
      this.#scope = undefined;
      this.#query = '';
    }, 'typeahead');
    const target = this.#options.target?.();
    if (!target) return;
    scope.listen(
      target,
      'keydown',
      (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.isComposing || editable(event.composedPath()[0])) return;
        if (this.type(event.key)) event.preventDefault();
      },
      { capture: true },
    );
  }

  /**
   * Add a typed key to the query and move to the match. Returns whether the key was used:
   * single characters always are, Space only while a query is in progress, other keys never.
   */
  type(key: string): boolean {
    const scope = this.#scope;
    if (!scope || [...key].length !== 1 || (key === ' ' && !this.#query)) return false;
    this.#clear?.();
    this.#query += key;
    this.#clear = scope.timeout(() => this.reset(), this.#options.timeout ?? 500);
    const items = this.#options.items();
    const index = this.#find(items);
    if (index >= 0) this.#options.onMatch(index, items[index] as T);
    return true;
  }

  /** Forget the query now. */
  reset(): void {
    this.#clear?.();
    this.#clear = undefined;
    this.#query = '';
  }

  #find(items: readonly T[]): number {
    const count = items.length;
    const chars = [...this.#query];
    const repeated = chars.every((char) => char === chars[0]);
    const search = repeated ? (chars[0] as string) : this.#query;
    const active = this.#options.active();
    const text = this.#options.text ?? defaultText;
    const skip = this.#options.skip ?? defaultSkip;
    this.#collator ??= new Intl.Collator(undefined, { usage: 'search', sensitivity: 'base' });
    const start = active < 0 ? 0 : repeated ? active + 1 : active;
    for (let n = 0; n < count; n++) {
      const i = (start + n) % count;
      const item = items[i] as T;
      if (skip(item)) continue;
      const prefix = text(item).trimStart().slice(0, search.length);
      if (this.#collator.compare(prefix, search) === 0) return i === active ? -1 : i;
    }
    return -1;
  }
}
