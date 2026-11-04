import { live } from '@oddkin/core/helpers/live';
import { html, nothing, repeat } from '@oddkin/core/template';
import type { TableColumn, TableRow } from '../models/table.js';
import { checkGlyph, chevronDownGlyph, chevronUpGlyph, minusGlyph } from '../styles/glyphs.js';
import { spinnerTemplate } from '../styles/spinner.styles.js';
import type { OddkinTable } from './table.js';

const alignClass = (column: TableColumn) => (column.align ? `align-${column.align}` : null);

/**
 * Anatomy: the `part="base"` scroll container around the native `part="table"`. The head row has
 * a `part="header-cell"` per column, with a `part="sort-button"` in a sortable one and
 * `aria-sort` on the sorted one; with `selection`, a first `part="selection"` column holds a
 * radio or checkbox per row (drawn as odd-checkbox and odd-radio-group draw theirs) and the
 * select-all checkbox. Body rows (`part="row"`) have a cell per column (`part="cell"`), the first
 * a row header. While loading, after an error, or with no rows, one row spans the columns with
 * its `part="status"` cell instead.
 */
export const tableTemplate = (table: OddkinTable) => {
  const columns = table._columns;
  const rows = table._rows;
  const strings = table._strings;
  const selection = table.selection;
  const selectable = selection !== 'none';
  const span = columns.length + (selectable ? 1 : 0) || 1;
  const all = rows.length > 0 && rows.every((row) => table._isSelected(row));
  const some = !all && rows.some((row) => table._isSelected(row));

  const header = (column: TableColumn) => {
    const sorted = table.sort === column.key;
    const glyph =
      sorted && (table.sortDirection === 'descending' ? chevronDownGlyph : chevronUpGlyph);
    return html`<th
      part="header-cell"
      scope="col"
      class=${alignClass(column)}
      aria-sort=${sorted ? table.sortDirection : null}
    >
      ${
        column.sortable
          ? html`<button
              part="sort-button"
              class="sort"
              type="button"
              @click=${() => table._sortBy(column)}
            >
              <span class="label">${column.label}</span
              ><span class="sort-mark" aria-hidden="true">${glyph || nothing}</span>
            </button>`
          : column.label
      }
    </th>`;
  };

  const control = (row: TableRow) =>
    html`<span class="indicator">
      <input
        class="indicator-box"
        type=${selection === 'single' ? 'radio' : 'checkbox'}
        name="selection"
        .checked=${live(table._isSelected(row))}
        aria-label=${table._rowLabel(row)}
        @input=${(event: Event) => table._onRowInput(row, event)}
        @change=${table._onChange}
      />${
        selection === 'single'
          ? html`<span class="indicator-mark indicator-dot"></span>`
          : html`<span class="indicator-mark indicator-check">${checkGlyph}</span>`
      }
    </span>`;

  const body = () => {
    if (table.loading)
      return html`<tr class="state-row">
        <td part="status" class="status" colspan=${span}>
          <span class="state">${spinnerTemplate}${strings.loading}</span>
        </td>
      </tr>`;
    if (table.error)
      return html`<tr class="state-row">
        <td part="status" class="status error" colspan=${span}>
          <div class="state" role="alert">${table.error}</div>
          <slot name="error"></slot>
        </td>
      </tr>`;
    if (!rows.length)
      return html`<tr class="state-row">
        <td part="status" class="status" colspan=${span}>
          <slot name="empty">${strings.empty}</slot>
        </td>
      </tr>`;
    return repeat(
      rows,
      (row) => row.id,
      (row) =>
        html`<tr part="row" class=${table._isSelected(row) ? 'selected' : null}>
          ${
            selectable
              ? html`<td part="cell selection" class="selection">${control(row)}</td>`
              : nothing
          }
          ${columns.map((column, index) =>
            index === 0
              ? html`<th part="cell" scope="row" class=${alignClass(column)}>
                  ${table._text(row.cells[column.key])}
                </th>`
              : html`<td part="cell" class=${alignClass(column)}>
                  ${table._text(row.cells[column.key])}
                </td>`,
          )}
        </tr>`,
    );
  };

  return html`<div part="base" class="root">
    <table
      part="table"
      class="table"
      aria-label=${table.label || null}
      aria-busy=${table.loading ? 'true' : null}
    >
      <thead>
        <tr>
          ${
            selectable
              ? html`<th part="header-cell selection" scope="col" class="selection">
                  ${
                    selection === 'multiple'
                      ? html`<span class="indicator">
                          <input
                            class="indicator-box"
                            type="checkbox"
                            .checked=${live(all)}
                            .indeterminate=${some}
                            data-state=${some ? 'mixed' : null}
                            aria-label=${strings.selectAll}
                            ?disabled=${!rows.length || table.loading || !!table.error}
                            @input=${table._onAllInput}
                            @change=${table._onChange}
                          /><span class="indicator-mark indicator-check">${checkGlyph}</span
                          ><span class="indicator-mark indicator-mixed">${minusGlyph}</span>
                        </span>`
                      : html`<span class="visually-hidden">${strings.selection}</span>`
                  }
                </th>`
              : nothing
          }
          ${columns.map(header)}
        </tr>
      </thead>
      <tbody>
        ${body()}
      </tbody>
    </table>
  </div>`;
};
