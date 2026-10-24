import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default menu look beyond the shared modules (the trigger is the button look, the
 * surface the overlay look, the rows the option-row look): Figma `Menu`'s inset rows, group
 * headings in secondary UI type, and separators in the default border colour.
 */
export const menuStyles = css`
  .menu {
    padding: ${token('space.xs')};
  }
  /* Figma MenuItem Focus: the hover surface under the shared ring. */
  .option:focus-visible {
    background: ${token('color.surface.hover')};
  }
  .group-label {
    padding: ${token('space.xs')} ${token('control.padding.inline.md')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .separator {
    margin-block: ${token('space.xs')};
    border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
`;
