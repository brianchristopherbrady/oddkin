import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { langOf, strings } from '@oddkin/core/i18n';
import type { TableCell, TableColumn, TableRow } from '../models/table.js';

export type { TableCell, TableColumn, TableRow } from '../models/table.js';

export const TABLE_STRINGS = {
  loading: 'Loading…',
  empty: 'No rows to show',
  yes: 'Yes',
  no: 'No',
  /** The selection column's header, read by assistive technology. */
  selection: 'Selection',
  /** Names a row's selection control; `{label}` is the row's first cell. */
  selectRow: 'Select {label}',
  selectAll: 'Select all rows',
};

export type TableSortDirection = 'ascending' | 'descending';

export interface TableSortDetail {
  /** Key of the column to sort by. */
  readonly column: string;
  /** The sort direction asked for. */
  readonly sortDirection: TableSortDirection;
}

/** The user asked to sort by a column. Cancel it to keep the current order. */
export const tableSortEvent = event<TableSortDetail>('odd-sort', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description:
    'A sortable header was activated; `detail` names the column and the new sort direction. Unless canceled, the table sets `sort` and `sortDirection`.',
});
/** The user changed the selection (`selected`): the native `input` of the row's control. */
export const tableInputEvent = event('input', {
  bubbles: true,
  composed: true,
  cancelable: false,
  syncs: 'selected',
  intent: 'user',
});
/** Dispatched after `input` for each user change of the selection (native `change` is not composed). */
export const tableChangeEvent = event('change', {
  bubbles: true,
  composed: false,
  cancelable: false,
  intent: 'user',
});

const isEmpty = (value: TableCell | undefined): value is null | undefined | '' =>
  value === null || value === undefined || value === '';

/**
 * Rows in the order `sort` and `sortDirection` give, stably: numbers as numbers, anything else as
 * text by `collator` (so false comes before true), and empty cells last in both directions.
 */
export function sortRows(
  rows: readonly TableRow[],
  key: string,
  direction: TableSortDirection,
  collator: Intl.Collator,
): TableRow[] {
  const sign = direction === 'descending' ? -1 : 1;
  const compare = (a: TableCell | undefined, b: TableCell | undefined): number => {
    if (isEmpty(a) || isEmpty(b)) return Number(isEmpty(a)) - Number(isEmpty(b));
    if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
    return sign * collator.compare(String(a), String(b));
  };
  // Array sorting is stable, so rows with equal cells keep their order.
  return [...rows].sort((a, b) => compare(a.cells[key], b.cells[key]));
}

/**
 * A data table: rows and columns from data (`columns`, `rows`, both JSON), shown as a native
 * table. Columns can sort the rows, rows can be selected, and the body shows a loading, error, or
 * empty state in place of the rows. No virtualization or editing: for a few hundred rows at most.
 *
 * @slot empty - Shown when there are no rows and nothing is loading (default `strings.empty`).
 * @slot error - Shown after the `error` message, for example a retry button.
 * @csspart base - The scroll container: a table wider than the element scrolls inside it.
 * @csspart table - The native `<table>`.
 * @csspart header-cell - Each column header (`th`).
 * @csspart sort-button - The button in a sortable column's header.
 * @csspart row - Each body row.
 * @csspart cell - Each body cell; the first column's cells are row headers.
 * @csspart selection - The cell holding a row's selection control, and its header.
 * @csspart status - The cell of the loading, error, or empty row.
 * @a11y A native table named by `label`, `aria-busy` while loading. The first column's cells are row headers (`th scope="row"`). A sortable header is a button inside its `th`, and the sorted column's `th` has `aria-sort`. With `selection`, each row has a radio (single) or a checkbox (multiple) named from its first cell ("Select {row}"), and a checkbox in the header selects every row; a selected row is marked by its checked control, not colour alone. The error message is announced (`role="alert"`).
 * @keyboard Native: Tab reaches each sort button and selection control in order; Enter or Space sorts; Space toggles a checkbox; the arrow keys move between the radios of a single selection.
 * @previewRole table
 * @useFor Records with the same fields, compared by column: lists of projects, people, orders, or files, with sorting and selection.
 * @notFor Page layout; key and value pairs of one record (use a description list); very large or editable data (the data grid, not yet available); navigation (use odd-side-nav).
 * @limitation Rows and columns are replaced, not mutated: assign new arrays to change them. Cells hold text, numbers, true or false, or nothing; a number shows as written, so format it as text if it needs separators (it then sorts as text).
 * @category Collections
 * @customization 1 2 3
 */
export class OddkinTable extends OddkinElement.with({
  label: prop.string({ default: '', description: 'Names the table.' }),
  columns: prop.object<readonly TableColumn[]>({
    description: 'The columns, in order (`oddkin.table-columns`).',
  }),
  rows: prop.object<readonly TableRow[]>({
    description: 'The rows (`oddkin.table-rows`); each cell is found by its column key.',
  }),
  sort: prop.string({
    default: '',
    reflect: true,
    description: 'Key of the column the rows are sorted by; empty for the given order.',
  }),
  sortDirection: prop.enum(['ascending', 'descending'], {
    default: 'ascending',
    reflect: true,
    description: 'Direction of the sort.',
  }),
  noSort: prop.boolean({
    reflect: true,
    description:
      'The table keeps rows in the given order: listen to `odd-sort` and assign `rows` in the new order. `sort` and `sortDirection` still mark the header.',
  }),
  selection: prop.enum(['none', 'single', 'multiple'], {
    default: 'none',
    reflect: true,
    description: 'Whether rows can be selected, one or several.',
  }),
  selected: prop.object<readonly string[]>({
    description: 'Ids of the selected rows (at most one with `single`).',
  }),
  loading: prop.boolean({
    reflect: true,
    description: 'Shows a busy row instead of the rows and marks the table busy.',
  }),
  error: prop.string({
    default: '',
    description: 'An error message, shown instead of the rows (with the `error` slot).',
  }),
  strings: prop.object<Partial<typeof TABLE_STRINGS>>({
    description: 'Localized string overrides; `selectRow` takes `{label}`.',
  }),
}) {
  static override events = {
    'odd-sort': tableSortEvent,
    input: tableInputEvent,
    change: tableChangeEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinTable>;

  /** @internal Localized strings. */
  get _strings(): typeof TABLE_STRINGS {
    return strings(TABLE_STRINGS, this.strings);
  }

  /** @internal The columns. */
  get _columns(): readonly TableColumn[] {
    return this.columns ?? [];
  }

  /** @internal The rows in the order shown. */
  get _rows(): readonly TableRow[] {
    const rows = this.rows ?? [];
    if (this.noSort || !this.sort) return rows;
    const collator = new Intl.Collator(langOf(this) ?? undefined, { numeric: true });
    return sortRows(rows, this.sort, this.sortDirection, collator);
  }

  /** @internal Text of a cell. */
  _text(value: TableCell | undefined): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? this._strings.yes : this._strings.no;
    return String(value);
  }

  /** @internal The name of a row's selection control. */
  _rowLabel(row: TableRow): string {
    const first = this._columns[0];
    const text = first ? this._text(row.cells[first.key]) : '';
    return this._strings.selectRow.replace('{label}', text || row.id);
  }

  /** @internal Whether the row is selected. */
  _isSelected(row: TableRow): boolean {
    return this.selection !== 'none' && (this.selected ?? []).includes(row.id);
  }

  /** @internal Template handler: a sortable header was activated. */
  _sortBy(column: TableColumn): void {
    const sortDirection: TableSortDirection =
      this.sort === column.key && this.sortDirection === 'ascending' ? 'descending' : 'ascending';
    if (!this.emit(tableSortEvent, { column: column.key, sortDirection })) return;
    this.sort = column.key;
    this.sortDirection = sortDirection;
  }

  /**
   * @internal Template handler: a row's control was toggled. `selected` changes before the native
   * `input`, which is composed, reaches listeners at the host as the table's own.
   */
  _onRowInput(row: TableRow, event: Event): void {
    // A radio is only ever checked by the user; a checkbox toggles.
    if (this.selection === 'single') this.selected = [row.id];
    else {
      const others = (this.selected ?? []).filter((id) => id !== row.id);
      this.selected = (event.target as HTMLInputElement).checked ? [...others, row.id] : others;
    }
  }

  /** @internal Template handler: the header checkbox selects every row, or none. */
  readonly _onAllInput = (event: Event): void => {
    const checked = (event.target as HTMLInputElement).checked;
    const ids = (this.rows ?? []).map((row) => row.id);
    const others = (this.selected ?? []).filter((id) => !ids.includes(id));
    this.selected = checked ? [...others, ...ids] : others;
  };

  /** @internal Template handler: the user committed a selection change. */
  readonly _onChange = (): void => {
    this.emit(tableChangeEvent);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-table': OddkinTable;
  }
  // Typed listeners on the element, its ancestors, document, and window (events bubble, composed).
  interface GlobalEventHandlersEventMap {
    'odd-sort': CustomEvent<TableSortDetail>;
  }
}
