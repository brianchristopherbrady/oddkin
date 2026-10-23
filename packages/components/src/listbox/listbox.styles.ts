import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default visual styles for the listbox: Figma `listbox`'s raised surface (default
 * border, `control.radius`, `elevation.md`), square option rows between dividers, group headings
 * in the small type role, and the empty and loading states in secondary text. The rows' look is
 * `optionRowStyles`; the label, help, and error are `controlStyles`.
 */
export const listboxStyles = css`
  .surface {
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.raised')};
    box-shadow: ${token('elevation.md')};
  }
  /* The active option's ring is the visible focus (Figma Keyboard focus); the listbox scrolls
     and clips its square rows to the surface's inner corners. */
  .listbox {
    border-radius: calc(${token('control.radius')} - ${token('border.width.default')});
  }
  .listbox:focus-visible {
    outline: none;
  }
  .option {
    border-radius: 0;
  }
  .option + .option,
  .group + .option,
  .option + .group,
  .group + .group {
    border-block-start: ${token('border.width.default')} solid ${token('color.border.default')};
  }
  .group-label {
    padding: ${token('space.xs')} ${token('control.padding.inline.md')};
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .state {
    gap: ${token('space.sm')};
    padding: ${token('space.md')};
    color: ${token('color.text.secondary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .field:has(.listbox[aria-disabled='true']) .label,
  .listbox[aria-disabled='true'] .option {
    color: ${token('color.text.disabled')};
  }
`;
