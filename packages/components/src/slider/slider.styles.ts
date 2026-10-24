import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default slider (Figma `slider`): the label and the output in the UI type role, a
 * `radius.xs` track in `color.border.strong` filled in `color.action.default` up to the value, a
 * round thumb on the default surface ringed in the action colour, endpoint labels in the small
 * role and secondary colour, and a slider area one field high. Disabled: the label, output, and
 * fill take the disabled text colour. Invalid: the danger ring on the thumb.
 */
export const sliderStyles = css`
  .output {
    color: ${token('color.text.primary')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
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
  .endpoints {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
  :host(:disabled) .label,
  :host(:disabled) .output {
    color: ${token('color.text.disabled')};
  }
  :host(:disabled) .fill {
    background: ${token('color.text.disabled')};
  }
`;
