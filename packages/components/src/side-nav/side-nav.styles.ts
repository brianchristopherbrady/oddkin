import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default visual styles for the side navigation, through `navigation.*` roles. */
export const sideNavStyles = css`
  .root {
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .group-items {
    gap: ${token('navigation.item.gap')};
    margin-block-start: ${token('navigation.item.gap')};
    padding-inline-start: ${token('navigation.indent')};
  }
  .entry,
  ::slotted(a) {
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
  /* The current page is marked by a bar and weight, not colour alone. */
  .entry[aria-current='page'] {
    border-inline-start-color: ${token('color.action.default')};
    background: ${token('color.surface.hover')};
    font-weight: ${token('font.weight.semibold')};
  }
  .entry:disabled,
  .entry[aria-disabled='true'] {
    color: ${token('color.text.disabled')};
  }
  .badge {
    flex: none;
    padding-inline: ${token('space.xs')};
    border-radius: ${token('radius.full')};
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  /* Points down when collapsed and up when expanded, the same in either text direction. */
  .chevron {
    flex: none;
    inline-size: 0.5em;
    block-size: 0.5em;
    border-inline-end: ${token('border.width.strong')} solid currentColor;
    border-block-end: ${token('border.width.strong')} solid currentColor;
    transform: translateY(-25%) rotate(45deg);
    transition: transform ${token('motion.duration.fast')} ${token('motion.easing.standard')};
  }
  .toggle[aria-expanded='true'] .chevron {
    transform: translateY(25%) rotate(-135deg);
  }
`;
