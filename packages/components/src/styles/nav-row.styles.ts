import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The navigation-row look through the `navigation.*` roles: padding, minimum target size, hover,
 * and the current or selected row marked by an inline-start bar and weight, not colour alone.
 * The bar is straight and inset by the row's block padding (Figma NavigationItem, State=Current),
 * so the row's rounded corners never bend it.
 */
export const navRowStyles = css`
  .entry {
    gap: ${token('navigation.item.gap')};
    min-block-size: max(${token('navigation.item.min-height')}, ${token('target.min')});
    padding: ${token('navigation.item.padding.block')} ${token('navigation.item.padding.inline')};
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
  .entry:is([aria-current='page'], [aria-selected='true']) {
    background: ${token('color.surface.hover')};
    font-weight: ${token('font.weight.semibold')};
  }
  .entry:is([aria-current='page'], [aria-selected='true'])::before {
    inset-block: ${token('navigation.item.padding.block')};
    inline-size: ${token('border.width.strong')};
    background: ${token('color.action.default')};
  }
  .entry:disabled,
  .entry[aria-disabled='true'] {
    color: ${token('color.text.disabled')};
  }
`;
