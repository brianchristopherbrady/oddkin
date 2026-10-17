import { css } from '@mote/core/styles';
import { token } from '@mote/tokens/refs';

/** Mote's default visual styles for the input. */
export const inputStyles = css`
  .field {
    gap: ${token('space.xs')};
    font-family: ${token('font.family.sans')};
    color: ${token('color.text.primary')};
  }
  .label {
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.semibold')};
  }
  .description {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .control {
    min-block-size: max(
      var(--mote-input-height, ${token('control.height.md')}),
      ${token('target.min')}
    );
    padding-inline: ${token('control.padding.inline.md')};
    border: ${token('border.width.default')} solid
      var(--mote-input-border-color, ${token('color.border.strong')});
    border-radius: var(--mote-input-radius, ${token('control.radius')});
    background: var(--mote-input-background, ${token('color.surface.default')});
    color: ${token('color.text.primary')};
    font-size: ${token('font.size.md')};
  }
  .control:focus-visible {
    outline: ${token('focus.width')} solid ${token('color.focus.ring')};
    outline-offset: ${token('focus.offset')};
  }
  .control[aria-invalid='true'] {
    border-color: ${token('color.border.danger')};
  }
  .control:disabled {
    background: ${token('color.surface.sunken')};
    color: ${token('color.text.disabled')};
  }
  .error {
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.danger')};
  }
`;
