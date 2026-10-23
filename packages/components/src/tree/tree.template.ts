import { styleMap } from '@oddkin/core/helpers/style-map';
import { html, repeat } from '@oddkin/core/template';
import { chevronDownGlyph, chevronEndGlyph } from '../styles/glyphs.js';
import type { OddkinTree, TreeRow } from './tree.js';

const spinner = html`<span class="spinner"></span>`;

const row = (tree: OddkinTree, row: TreeRow) =>
  html`<div
    role="treeitem"
    part="item"
    class="entry"
    aria-level=${row.level}
    aria-setsize=${row.size}
    aria-posinset=${row.position}
    aria-expanded=${row.expandable ? String(row.expanded) : null}
    aria-selected=${row.selected ? 'true' : tree.multiple ? 'false' : null}
    aria-disabled=${row.item.disabled ? 'true' : null}
    aria-busy=${row.busy ? 'true' : null}
    style=${styleMap({ '--_level': String(row.level - 1) })}
  >
    <span class="toggle" aria-hidden="true"
      >${row.busy ? spinner : row.expandable ? (row.expanded ? chevronDownGlyph : chevronEndGlyph) : null}</span
    >${row.item.icon ? html`<odd-icon src=${row.item.icon} size="sm"></odd-icon>` : null}<span
      class="label"
      >${row.item.label}</span
    >
  </div>`;

/**
 * Anatomy: `part="base"` surface holding the `part="tree"` rows (flat `treeitem` rows with their
 * level, from the shown part of the hierarchy), the `part="loading"` busy row, the `part="empty"`
 * state, and the `status` slot. A row is a chevron (`.toggle`; a click on it expands or
 * collapses), an optional icon, and the label.
 */
export const treeTemplate = (tree: OddkinTree) => {
  const rows = tree._rows.value;
  const strings = tree._strings;
  return html`<div part="base" class="root">
    <div
      part="tree"
      class="tree"
      role="tree"
      aria-label=${tree.label || null}
      aria-multiselectable=${tree.multiple ? 'true' : null}
      aria-busy=${tree.loading ? 'true' : null}
      ?hidden=${!rows.length}
      @click=${tree._onClick}
      @keydown=${tree._onKeydown}
    >
      ${repeat(
        rows,
        (each) => each.item.id,
        (each) => row(tree, each),
      )}
    </div>
    <div part="loading" class="state" ?hidden=${!tree.loading}>${spinner}${strings.loading}</div>
    <div part="empty" class="state" ?hidden=${rows.length > 0 || tree.loading}>
      <slot name="empty">${strings.empty}</slot>
    </div>
    <slot name="status"></slot>
  </div>`;
};
