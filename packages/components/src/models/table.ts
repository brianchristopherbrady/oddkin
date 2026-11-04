/**
 * The table models: the single source for the `TableColumn` and `TableRow` types, runtime
 * validation of external data, and the published JSON Schemas (odd-table's `columns` and `rows`).
 * Contract: docs/architecture/data-composition.md §2, §5.
 */
import { defineModel, m, type ModelRule } from '@oddkin/core/model';

/**
 * Row ids are unique among the rows. Unlike `m.uniqueIds`, the cells are not searched: a table may
 * have a column keyed "id", whose values are not row ids. Rules run on data the schema accepted.
 */
const uniqueRowIds: ModelRule = {
  kind: 'uniqueIds',
  description: 'uniqueIds(id) among the rows',
  check(rows, report) {
    const seen = new Map<unknown, number>();
    (rows as readonly { id: string }[]).forEach(({ id }, index) =>
      seen.has(id)
        ? report(
            `/${index}/id`,
            'model.id.duplicate',
            `${JSON.stringify(id)} is already used at /${seen.get(id)}/id.`,
          )
        : seen.set(id, index),
    );
  },
};

export const TableColumnModel = defineModel('oddkin.table-columns', {
  version: 1,
  description: 'Columns of a table, in order: the cell each shows, its header, and its sorting.',
  schema: m.array(
    m.object({
      key: m.id('Names the cell of each row that the column shows.'),
      label: m.label('Header text, which also names the column.'),
      align: m.optional(m.enum(['start', 'center', 'end'], 'Alignment of the column (start).')),
      sortable: m.optional(m.boolean('The header sorts the rows by this column.')),
    }),
  ),
  rules: [m.uniqueIds('key')],
});

export const TableRowModel = defineModel('oddkin.table-rows', {
  version: 1,
  description: 'Rows of a table: an id, and the value of each cell by column key.',
  schema: m.array(
    m.object({
      id: m.id('Identifies the row, for selection.'),
      cells: m.record(
        m.scalar(),
        'Cell values by column key: text, a number, true or false, or null for an empty cell.',
      ),
    }),
  ),
  rules: [uniqueRowIds],
});

// Named interfaces, so the element's manifest names its property types (`readonly TableColumn[]`),
// which compositions map to these models; the tests check they equal what the models infer.

/** One column of a table. */
export interface TableColumn {
  /** Names the cell of each row that the column shows. */
  key: string;
  /** Header text, which also names the column. */
  label: string;
  /** Alignment of the column's header and cells (`start`). */
  align?: 'start' | 'center' | 'end' | undefined;
  /** The header sorts the rows by this column. */
  sortable?: boolean | undefined;
}

/** One cell's value: text, a number, true or false, or null for an empty cell. */
export type TableCell = string | number | boolean | null;

/** One row of a table. */
export interface TableRow {
  /** Identifies the row, for selection. */
  id: string;
  /** Cell values by column key. */
  cells: { [key: string]: TableCell };
}
