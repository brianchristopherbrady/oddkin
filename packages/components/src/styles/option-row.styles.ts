import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The option-row look (Figma `ListboxOption`, `MenuItem`, `CommandItem`): control-sized rows in the
 * UI type role, a pointer hover, the selection surface with its check, an inset focus ring on the
 * active or focused row, secondary end text, the danger tone, and disabled text. Rows are
 * transparent over the surface they sit on.
 */
export const optionRowStyles = css`
  .option {
    gap: ${token('control.gap')};
    min-block-size: max(${token('control.height.md')}, ${token('target.min')});
    padding-inline: ${token('control.padding.inline.md')};
    border-radius: ${token('control.radius')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  @media (hover: hover) {
    .option:not([aria-disabled='true']):hover {
      background: ${token('color.surface.hover')};
    }
  }
  .option[aria-selected='true'],
  .option[aria-checked='true'] {
    background: ${token('color.selection.surface')};
  }
  .option.active,
  .option:focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: calc(-1 * ${token('focus.width')});
  }
  .option-description,
  .option-end {
    color: ${token('color.text.secondary')};
  }
  .option-description {
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .option.danger {
    color: ${token('color.danger.foreground')};
  }
  .option[aria-disabled='true'],
  .option[aria-disabled='true'] .option-description,
  .option[aria-disabled='true'] .option-end {
    color: ${token('color.text.disabled')};
  }
`;
