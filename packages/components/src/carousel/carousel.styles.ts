import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default carousel look (Figma `carousel`): the slide on the sunken surface with the
 * default border, previous and next as small icon buttons that look disabled at the ends, the
 * position in UI type, and each slide button as a small framed number, the shown one on the
 * selection surface in the link colour.
 */
export const carouselStyles = css`
  .carousel,
  .controls,
  .picker {
    gap: ${token('space.sm')};
  }
  .slide {
    padding: ${token('space.lg')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.primary')};
  }
  .step {
    --odd-button-padding-inline: ${token('space.none')};
    min-inline-size: max(${token('control.height.sm')}, ${token('target.min')});
    font-size: ${token('icon.size.md')};
  }
  .step[aria-disabled='true'] {
    border-color: transparent;
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .position,
  .pick {
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .position {
    color: ${token('color.text.primary')};
  }
  .pick {
    min-inline-size: ${token('target.min')};
    min-block-size: ${token('target.min')};
    padding: ${token('space.2xs')};
    border: ${token('border.width.default')} solid ${token('color.border.default')};
    border-radius: ${token('control.radius')};
    background: ${token('color.surface.default')};
    color: ${token('color.text.secondary')};
  }
  @media (hover: hover) {
    .pick:not([aria-current='true']):hover {
      background: ${token('color.surface.hover')};
    }
  }
  .pick[aria-current='true'] {
    background: ${token('color.selection.surface')};
    color: ${token('color.link')};
  }
`;
