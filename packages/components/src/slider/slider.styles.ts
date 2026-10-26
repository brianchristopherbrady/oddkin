import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { rangeStyles } from '../styles/range.styles.js';

/**
 * Oddkin's default slider (Figma `slider`): the shared slider area (track, fill, and thumb), the
 * label and the output in the UI type role, and endpoint labels in the small role and secondary
 * colour. Disabled: the label and output take the disabled text colour (the fill too, in the
 * shared area).
 */
export const sliderStyles = css`
  ${rangeStyles}
  .output {
    color: ${token('color.text.primary')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
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
`;
