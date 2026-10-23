import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default switch (Common page, Figma `switch`): a full-radius track with the strong
 * border on the sunken surface, the selection background when on; the thumb in secondary text,
 * the selection foreground when on, and disabled text when disabled and off.
 */
export const switchStyles = css`
  .switch-track {
    border: ${token('border.width.default')} solid ${token('color.border.strong')};
    border-radius: ${token('radius.full')};
    background: ${token('color.surface.sunken')};
    transition-property: border-color, background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .switch-track:checked {
    background: ${token('color.selection.background')};
  }
  .switch-track[aria-invalid='true'] {
    border-color: ${token('color.danger.foreground')};
  }
  .switch-thumb {
    border-radius: ${token('radius.full')};
    background: ${token('color.text.secondary')};
    transition-property: margin-inline-start, background-color;
    transition-duration: ${token('motion.duration.fast')};
    transition-timing-function: ${token('motion.easing.standard')};
  }
  .switch-track:disabled + .switch-thumb {
    background: ${token('color.text.disabled')};
  }
  .switch-track:checked + .switch-thumb {
    background: ${token('color.selection.foreground')};
  }
`;
