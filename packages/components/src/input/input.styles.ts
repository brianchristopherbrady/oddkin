import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default visual styles for the input. */
export const inputStyles = css`
  .field {
    gap: ${token('space.xs')};
    font-family: ${token('type.body.family')};
    color: ${token('color.text.primary')};
  }
  .label {
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .description,
  .error {
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  .description {
    color: ${token('color.text.secondary')};
  }
  .control {
    min-block-size: max(
      var(--odd-input-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    padding-inline: ${token('control.padding.inline.md')};
    border: ${token('border.width.default')} solid
      var(--odd-input-border-color, ${token('color.border.strong')});
    border-radius: var(--odd-input-radius, ${token('control.radius')});
    background: var(--odd-input-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    /* Body size: below 16px, iOS Safari zooms the page when the field takes focus. */
    font-size: ${token('type.body.size')};
    line-height: ${token('type.body.line-height')};
    transition-property: border-color, background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .control[aria-invalid='true'] {
    border-color: ${token('color.danger.foreground')};
  }
  .control:disabled {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .error {
    color: ${token('color.danger.foreground')};
  }
`;
