import { FocusRecovery, RovingFocus } from '@oddkin/core/controllers/focus';
import { Typeahead } from '@oddkin/core/controllers/typeahead';
import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { strings } from '@oddkin/core/i18n';
import type { Readable } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { TreeItemRecord } from '../collection/collection.js';
import { TreeModel, treeToggleEvent, type TreeRow } from '../collection/tree-model.js';

export type { TreeItemRecord } from '../collection/collection.js';
export type { TreeRow } from '../collection/tree-model.js';

export const TREE_STRINGS = { loading: 'Loading…', empty: 'No items available' };

/** The user asked to expand or collapse an item; cancel it to keep the current state. */
export { treeToggleEvent };
/** The user selected an item (`value`, or `values` with `multiple`). */
export const treeInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'value',
  intent: 'user',
});
/** Dispatched after `input` for each user selection (native `change` is not composed). */
export const treeChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

/**
 * A hierarchy the user browses and selects in (APG tree view): rows of items that expand and
 * collapse, from `items`. Items holding a selected item start expanded. Children of a `lazy` item
 * load when it first expands: listen to `odd-toggle`, then assign new `items` in which that item
 * has `children`.
 *
 * @slot empty - Shown when there are no items and nothing is loading (default `strings.empty`).
 * @slot status - Status content such as an error and a retry button.
 * @csspart base - The surface.
 * @csspart tree - The `role="tree"` list of rows.
 * @csspart item - Each row (`role="treeitem"`).
 * @csspart loading - The busy row while `loading`.
 * @csspart empty - The wrapper of the empty slot.
 * @a11y A `tree` named by `label`, `aria-multiselectable` with `multiple`, `aria-busy` while loading. Each row is a `treeitem` with `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` when it has children, `aria-selected`, and `aria-busy` while its lazy children load. Selection is marked by a bar and weight, not colour alone. Disabled rows are skipped by the keyboard.
 * @keyboard Tab reaches the selected row (or the first). Up and Down move between shown rows; Home and End go to the first and last. Right expands a closed row, or moves into an open one; Left collapses an open row, or moves to its parent (mirrored right to left). `*` expands every sibling. Enter or Space selects (with `multiple`, toggles). Typing moves to the next row whose label starts with the typed characters.
 * @previewRole tree
 * @useFor Browsing and choosing in nested data: files, folders, categories, an outline.
 * @notFor Site navigation (use odd-side-nav); a flat list of choices (use odd-listbox); content sections (use odd-disclosure).
 * @category Collections
 * @customization 1 2 3
 */
export class OddkinTree extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the tree.' }),
  items: prop.object<readonly TreeItemRecord[]>({
    description: 'The top-level items; each may hold `children`, or be `lazy`.',
  }),
  expanded: prop.object<readonly string[]>({
    description:
      'Ids of expanded items, owned by the caller. Omit it to let the element track expansion.',
  }),
  value: prop.string({ default: '', description: 'Id of the selected item.' }),
  values: prop.object<readonly string[]>({
    description: 'Ids of the selected items with `multiple`.',
  }),
  multiple: prop.boolean({ reflect: true, description: 'Several items can be selected.' }),
  loading: prop.boolean({
    reflect: true,
    description: 'Shows a busy row and marks the tree busy.',
  }),
  strings: prop.object<Partial<typeof TREE_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'odd-toggle': treeToggleEvent,
    input: treeInputEvent,
    change: treeChangeEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinTree>;

  readonly #model = new TreeModel({
    items: () => this.items,
    expanded: () => this.expanded,
    selected: (item) => this._isSelected(item),
    report: (detail) => this.emit(treeToggleEvent, detail),
  });
  readonly #roving = new RovingFocus({
    target: () => this.#tree(),
    items: () => this._rowElements(),
    orientation: 'vertical',
    wrap: false,
  });
  readonly #typeahead = new Typeahead({
    items: () => this._rowElements(),
    active: () => this.#roving.activeIndex,
    text: (row) => row.querySelector('.label')?.textContent ?? '',
    onMatch: (index) => this.#roving.setActive(index, { focus: true }),
  });

  /** @internal The shown rows, in order. */
  readonly _rows: Readable<readonly TreeRow[]> = this.#model.rows;

  /** @internal Localized strings. */
  get _strings(): typeof TREE_STRINGS {
    return strings(TREE_STRINGS, this.strings);
  }

  /** @internal Whether the item is selected. */
  _isSelected(item: TreeItemRecord): boolean {
    return this.multiple ? (this.values ?? []).includes(item.id) : this.value === item.id;
  }

  /** @internal The row elements, in the order of `_rows`. */
  _rowElements(): HTMLElement[] {
    return [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
  }

  #tree(): HTMLElement | null | undefined {
    return this.shadowRoot?.querySelector<HTMLElement>('[part~="tree"]');
  }

  #rowOf(event: Event): TreeRow | undefined {
    const elements = this._rowElements();
    const index = elements.findIndex((row) => event.composedPath().includes(row));
    return this._rows.peek()[index];
  }

  #focus(item: TreeItemRecord): void {
    const index = this._rows.peek().findIndex((row) => row.item === item);
    if (index >= 0) this.#roving.setActive(index, { focus: true });
  }

  /** @internal Selects the item (with `multiple`, toggles it) and reports it. */
  _select(item: TreeItemRecord): void {
    if (item.disabled) return;
    if (this.multiple) {
      const values = this.values ?? [];
      this.values = values.includes(item.id)
        ? values.filter((id) => id !== item.id)
        : [...values, item.id];
    } else {
      if (this.value === item.id) return;
      this.value = item.id;
    }
    this.emit(treeInputEvent);
    this.emit(treeChangeEvent);
  }

  /** @internal Template handler: a click on the chevron toggles; elsewhere on a row it selects. */
  readonly _onClick = (event: MouseEvent): void => {
    const row = this.#rowOf(event);
    if (!row) return;
    const toggle = event
      .composedPath()
      .some((node) => (node as Element).classList?.contains('toggle'));
    if (toggle) this.#model.toggle(row.item);
    else this._select(row.item);
  };

  /** @internal Template handler: APG tree keys beyond the roving focus (Up, Down, Home, End). */
  readonly _onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const row = this.#rowOf(event);
    if (!row || event.isComposing) return;
    const { item } = row;
    const rtl = getComputedStyle(this).direction === 'rtl';
    switch (event.key) {
      case 'Enter':
        this._select(item);
        break;
      case ' ':
        // Space continues a typeahead query in progress; otherwise it selects.
        if (!this.#typeahead.type(' ')) this._select(item);
        break;
      default:
        if (
          !this.#model.key(event.key, row, rtl, (to) => this.#focus(to)) &&
          !this.#typeahead.type(event.key)
        )
          return;
    }
    event.preventDefault();
  };

  protected override mounted(scope: Scope): void {
    const root = this.shadowRoot!;
    scope.use(this.#typeahead);
    scope.use(this.#roving);
    scope.use(
      new FocusRecovery({
        root: () => root,
        fallback: () => this._rowElements()[this.#roving.activeIndex],
      }),
    );
  }

  // After each render: the focused row keeps the Tab stop as rows come and go above it; with
  // focus outside, the selected row takes it.
  protected override updated(): void {
    const focused = this._rowElements().indexOf(this.shadowRoot?.activeElement as HTMLElement);
    const index = focused >= 0 ? focused : this._rows.peek().findIndex((row) => row.selected);
    if (index >= 0) this.#roving.setActive(index);
    else this.#roving.sync();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-tree': OddkinTree;
  }
}
