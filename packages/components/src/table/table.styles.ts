import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default visual styles for the table, as the `.odd-table` recipe draws a native table:
 * a bordered surface with `card.radius`, header cells on the sunken surface in secondary text
 * (the sorted one in primary), rows divided by rules, a hover surface, selected rows in the
 * selection colours, and the state rows in secondary text (an error in the danger colour).
 */
export const tableStyles = css`
  .root {
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
  }
  .table {
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  th,
  td {
    padding: ${token('space.sm')} ${token('space.md')};
  }
  tbody th {
    font-weight: inherit;
  }
  thead th {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.secondary')};
    font-weight: ${token('font.weight.medium')};
  }
  thead th[aria-sort] {
    color: ${token('color.text.primary')};
  }
  tbody tr + tr > * {
    border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
  @media (hover: hover) {
    tbody tr:not(.state-row, .selected):hover {
      background: ${token('color.surface.hover')};
    }
  }
  tr.selected {
    background: ${token('color.selection.surface')};
  }
  .status {
    padding: ${token('space.md')};
    color: ${token('color.text.secondary')};
  }
  .status.error .state {
    color: ${token('color.danger.foreground')};
  }
  .indicator {
    font-size: ${token('icon.size.sm')};
  }
  .indicator-dot {
    background: currentColor;
  }
  :is(.indicator-box[type='radio'], .indicator-dot) {
    border-radius: ${token('radius.full')};
  }
`;
