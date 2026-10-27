import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default alert: Figma `alert` (tone surface, `control/radius`, UI title in the tone
 * colour, Small message in the primary text colour).
 */
export const alertStyles = css`
  .alert {
    padding: ${token('space.sm')};
    border-radius: var(--odd-alert-radius, ${token('control.radius')});
    background: var(--_tone-surface);
    color: ${token('color.text.primary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
  }
  .marker,
  .label {
    color: var(--_tone-foreground);
  }
  /* A neutral alert's message takes the neutral foreground too, as Figma draws it. */
  :host([tone='neutral']) .alert {
    color: var(--_tone-foreground);
  }
  .marker {
    font-size: ${token('icon.size.md')};
  }
  .label {
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
  }
`;
