import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default pagination: Figma `Pagination` (a default surface with `control/radius`; the
 * position in secondary text; square controls bordered in `border/default`, previous and next in
 * `border/strong`; the current page in the selection colours).
 */
export const paginationStyles = css`
  .pagination {
    padding: ${token('space.xs')};
    border-radius: var(--odd-pagination-radius, ${token('control.radius')});
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
  .status {
    color: ${token('color.text.secondary')};
  }
  .tile {
    min-inline-size: ${token('control.height.md')};
    min-block-size: ${token('control.height.md')};
    padding-inline: ${token('space.xs')};
    border-width: ${token('border.width.default')};
    border-color: ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.primary')};
  }
  .step {
    border-color: ${token('color.border.strong')};
    font-size: ${token('icon.size.md')};
  }
  .tile[aria-current='page'] {
    border-color: transparent;
    background: ${token('color.selection.background')};
    color: ${token('color.selection.foreground')};
  }
  .tile:disabled,
  .tile[aria-disabled='true'] {
    color: ${token('color.text.disabled')};
  }
  .ellipsis {
    color: ${token('color.text.secondary')};
    font-size: ${token('icon.size.md')};
  }
  @media (hover: hover) {
    .tile:not(:disabled, [aria-disabled='true'], [aria-current='page']):hover {
      background: ${token('color.surface.hover')};
    }
  }
`;
