import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default rating (Figma `rating`, `rating/Item`): `control.height.sm` star targets with
 * the small radius, `space.2xs` apart, holding a 20 px star (`icon.size.md`) in the strong border
 * colour, filled in the selection colour up to the chosen star and in the disabled text colour
 * while disabled; a pointer hover on an editable star. The value sits `space.sm` after the stars
 * in the small type role and the secondary text colour; the label is dimmed while disabled.
 */
export const ratingStyles = css`
  .row {
    gap: ${token('space.sm')};
  }
  .stars {
    gap: ${token('space.2xs')};
  }
  .star {
    inline-size: ${token('control.height.sm')};
    block-size: ${token('control.height.sm')};
    color: ${token('color.border.strong')};
    font-size: ${token('icon.size.md')};
  }
  .star-box {
    border-radius: ${token('radius.sm')};
    transition-property: background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  @media (hover: hover) {
    :host(:not([readonly])) .star-box:enabled:hover {
      background: ${token('color.surface.hover')};
    }
  }
  .star[data-state='on'] {
    color: ${token('color.selection.background')};
  }
  .star-box:disabled + .glyph {
    color: ${token('color.text.disabled')};
  }
  .value {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  :host(:disabled) .label {
    color: ${token('color.text.disabled')};
  }
`;
