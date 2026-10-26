import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's slider area (Figma `slider`): one field high; a `radius.xs` track in
 * `color.border.strong` filled in `color.action.default` up to the value; a round thumb on the
 * default surface ringed in the action colour, in the danger colour when invalid; disabled, the
 * fill takes the disabled text colour. Interpolated into each element's visual sheet.
 */
export const rangeStyles = css`
  .slider {
    min-block-size: ${token('control.height.md')};
  }
  .track,
  .fill {
    border-radius: ${token('radius.xs')};
  }
  .track {
    background: ${token('color.border.strong')};
  }
  .fill {
    background: ${token('color.action.default')};
  }
  .thumb {
    border: ${token('border.width.default')} solid ${token('color.action.default')};
    border-radius: ${token('radius.full')};
    background: ${token('color.surface.default')};
  }
  .thumb[aria-invalid='true'] {
    border-color: ${token('color.danger.foreground')};
  }
  :host(:disabled) .fill {
    background: ${token('color.text.disabled')};
  }
`;
