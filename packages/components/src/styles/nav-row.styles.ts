import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The navigation-row look through the `navigation.*` roles: padding, minimum target size, hover,
 * and the current row marked by an inline-start bar and weight, not colour alone.
 */
export const navRowStyles = css`
  .entry {
    gap: ${token('navigation.item.gap')};
    min-block-size: max(${token('navigation.item.min-height')}, ${token('target.min')});
    padding: ${token('navigation.item.padding.block')} ${token('navigation.item.padding.inline')};
    border-inline-start: ${token('border.width.strong')} solid transparent;
    border-radius: ${token('control.radius')};
    transition-property: background-color, color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  @media (hover: hover) {
    .entry:not(:disabled, [aria-disabled='true']):hover {
      background: ${token('color.surface.hover')};
    }
  }
  .entry[aria-current='page'] {
    border-inline-start-color: ${token('color.action.default')};
    background: ${token('color.surface.hover')};
    font-weight: ${token('font.weight.semibold')};
  }
  .entry:disabled,
  .entry[aria-disabled='true'] {
    color: ${token('color.text.disabled')};
  }
`;
