import { event } from '@oddkin/core/element';
import { computed, signal, type Readable } from '@oddkin/core/reactive';
import type { NavigationToggleDetail } from '../side-nav/side-nav.js';
import type { TreeItemRecord } from './collection.js';

/** The user asked to expand or collapse an item; cancel it to keep the current state. */
export const treeToggleEvent = event<NavigationToggleDetail>('odd-toggle', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description:
    'An item is about to expand or collapse; cancelable. Load the children of a lazy item here.',
});

/** A shown row: its item, place in the hierarchy, and state. */
export interface TreeRow {
  readonly item: TreeItemRecord;
  /** 1 at the top. */
  readonly level: number;
  readonly size: number;
  readonly position: number;
  readonly parent: TreeItemRecord | undefined;
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly selected: boolean;
  /** Expanded while its lazy children load. */
  readonly busy: boolean;
}

export interface TreeModelOptions {
  /** The top-level items. */
  readonly items: () => readonly TreeItemRecord[] | undefined;
  /** Ids of expanded items when the caller owns expansion, else undefined. */
  readonly expanded: () => readonly string[] | undefined;
  /** Whether the item is selected (a reactive read). */
  readonly selected: (item: TreeItemRecord) => boolean;
  /** Reports a user's expand or collapse (`odd-toggle`); false when it was cancelled. */
  readonly report: (detail: NavigationToggleDetail) => boolean;
}

/**
 * What every element showing a hierarchy as `treeitem` rows shares (`odd-tree`, `odd-picker`):
 * the shown rows from `items`, expansion (as the caller's `expanded` says; otherwise as the user
 * left it, else open when it holds a selected item; selecting never expands or selects
 * descendants), the user's toggles reported as `odd-toggle` (cancelable; a lazy item is busy until
 * it has `children`), and the APG keys that act on the hierarchy. Focus is the element's: rows
 * move with roving focus (`odd-tree`) or as the active descendant of a combobox (`odd-picker`).
 * Internal to `@oddkin/components`.
 */
export class TreeModel {
  readonly #options: TreeModelOptions;
  // Expansion the user chose while `expanded` is not set; other items follow the selection.
  readonly #toggled = signal<ReadonlyMap<string, boolean>>(new Map());

  /** The shown rows, in order. */
  readonly rows: Readable<readonly TreeRow[]>;

  constructor(options: TreeModelOptions) {
    this.#options = options;
    this.rows = computed(() => {
      const rows: TreeRow[] = [];
      const walk = (items: readonly TreeItemRecord[], level: number, parent?: TreeItemRecord) =>
        items.forEach((item, index) => {
          const expanded = this.isExpanded(item);
          rows.push({
            item,
            level,
            size: items.length,
            position: index + 1,
            parent,
            expandable: this.expandable(item),
            expanded,
            selected: options.selected(item),
            busy: expanded && !!item.lazy && !item.children,
          });
          if (expanded && item.children) walk(item.children, level + 1, item);
        });
      walk(options.items() ?? [], 1);
      return rows;
    });
  }

  /** Whether the item has (or will load) children. */
  expandable(item: TreeItemRecord): boolean {
    return item.children ? item.children.length > 0 : !!item.lazy;
  }

  /** Whether the item is expanded. */
  isExpanded(item: TreeItemRecord): boolean {
    if (!this.expandable(item)) return false;
    const expanded = this.#options.expanded();
    if (expanded) return expanded.includes(item.id);
    return this.#toggled.value.get(item.id) ?? this.#holdsSelected(item);
  }

  #holdsSelected(item: TreeItemRecord): boolean {
    return !!item.children?.some(
      (child) => this.#options.selected(child) || this.#holdsSelected(child),
    );
  }

  /** Expands or collapses an item after `odd-toggle`, unless that is cancelled. */
  toggle(item: TreeItemRecord, expanded = !this.isExpanded(item)): void {
    if (item.disabled || !this.expandable(item) || expanded === this.isExpanded(item)) return;
    if (!this.#options.report({ id: item.id, expanded }) || this.#options.expanded()) return;
    this.#toggled.value = new Map(this.#toggled.peek()).set(item.id, expanded);
  }

  /**
   * The keys that act on the hierarchy (APG tree view): Right expands a closed row or moves into
   * an open one, Left collapses an open row or moves to its parent (mirrored right to left), `*`
   * expands every sibling. `move` makes an item the focused or active row. False for other keys,
   * and for Right on a row without children.
   */
  key(key: string, row: TreeRow, rtl: boolean, move: (item: TreeItemRecord) => void): boolean {
    const mirrored = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' } as Record<string, string>;
    const { item } = row;
    switch ((rtl && mirrored[key]) || key) {
      case 'ArrowRight':
        if (!row.expandable) return false;
        if (!row.expanded) this.toggle(item, true);
        else if (item.children?.[0]) move(item.children[0]);
        break;
      case 'ArrowLeft':
        if (row.expanded) this.toggle(item, false);
        else if (row.parent) move(row.parent);
        break;
      case '*':
        for (const sibling of row.parent?.children ?? this.#options.items() ?? [])
          this.toggle(sibling, true);
        break;
      default:
        return false;
    }
    return true;
  }

  /** The item with `id` and its ancestors, outermost first; empty when there is none. */
  path(id: string): TreeItemRecord[] {
    const find = (items: readonly TreeItemRecord[]): TreeItemRecord[] => {
      for (const item of items) {
        if (item.id === id) return [item];
        const below = item.children ? find(item.children) : [];
        if (below.length) return [item, ...below];
      }
      return [];
    };
    return find(this.#options.items() ?? []);
  }
}
