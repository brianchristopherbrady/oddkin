import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default radio group (Figma `radioGroup`, `radio`): the control-indicator box made
 * round with a dot in the selection foreground; the legend, description, and error are the
 * shared control look. Options sit one target height apart, as Figma's 48 px rows, each
 * description in the small role under its label. The legend keeps its colour while the group is
 * disabled, as Figma's CheckboxGroup draws it; the options show the disabled look.
 */
export const radioGroupStyles = css`
  .options {
    gap: ${token('space.lg')};
    padding-block: ${token('space.sm')};
  }
  .indicator-box,
  .indicator-dot {
    border-radius: ${token('radius.full')};
  }
  .indicator-dot {
    background: currentColor;
  }
  .option-description {
    padding-inline-start: calc(${token('space.2xs')} + 1.25rem + ${token('space.sm')});
  }
  .group-label {
    color: ${token('color.text.secondary')};
    font-size: ${token('type.small.size')};
    line-height: ${token('type.small.line-height')};
  }
`;
