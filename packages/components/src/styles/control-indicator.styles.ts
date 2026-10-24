import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The checkbox look of the Common page (158:22): a `radius.sm` box on the default surface with a
 * strong border, the selection colours with a drawn check or minus when checked or mixed, the
 * danger border when invalid (strong when checked), and the sunken surface when disabled and
 * unchecked. Hover applies inside a `.choice` row, the label the box sits in: `space.sm` between
 * box and label, the target size, and the disabled text colour.
 */
export const controlIndicatorStyles = css`
  .choice {
    gap: ${token('space.sm')};
    min-block-size: ${token('target.min')};
    padding-inline: ${token('space.2xs')};
  }
  .choice:has(:disabled) {
    color: ${token('color.text.disabled')};
  }
  .indicator {
    font-size: ${token('icon.size.sm')};
  }
  .indicator-box {
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.sm')};
    background: ${token('color.surface.default')};
    transition-property: border-color, background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .indicator-mark {
    color: ${token('color.selection.foreground')};
  }
  .indicator-box:is(:checked, [data-state]) {
    border-color: transparent;
    background: ${token('color.selection.background')};
  }
  @media (hover: hover) {
    .choice:hover .indicator-box:not(:checked, [data-state], :disabled) {
      background: ${token('color.surface.hover')};
    }
  }
  .indicator-box[aria-invalid='true'] {
    border-color: ${token('color.danger.foreground')};
  }
  .indicator-box[aria-invalid='true']:is(:checked, [data-state]) {
    border-width: ${token('border.width.strong')};
  }
  .indicator-box:disabled:not(:checked, [data-state]) {
    background: ${token('color.surface.sunken')};
  }
`;
