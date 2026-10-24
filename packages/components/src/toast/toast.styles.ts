import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default toast: Figma `toast` (the default surface, `card.radius`, `elevation.lg`; the
 * title in the UI style and primary text, the message in Small and secondary text), the glyph in
 * the tone's colour, `space.md` from the viewport's edges and `space.sm` between toasts. The
 * close button's target sets the first line's height, so the block-start and inline-end padding
 * is smaller.
 */
export const toastStyles = css`
  :host([popover]) {
    --_toast-inset: ${token('space.md')};
    --_toast-gap: ${token('space.sm')};
    border-radius: ${token('card.radius')};
    background: ${token('color.surface.default')};
    box-shadow: ${token('elevation.lg')};
  }
  .toast {
    column-gap: ${token('space.sm')};
    padding-block: ${token('space.sm')} ${token('space.md')};
    padding-inline: ${token('space.md')} ${token('space.sm')};
  }
  .marker {
    color: var(--_tone-foreground);
    font-size: ${token('icon.size.md')};
  }
  .label {
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
  .message {
    color: ${token('color.text.secondary')};
    font-family: ${token('type.small.family')};
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
    letter-spacing: ${token('type.small.letter-spacing')};
  }
`;
