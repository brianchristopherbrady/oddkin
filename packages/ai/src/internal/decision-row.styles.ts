import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * The decision row's lines (Figma page 08, `Oddkin/AI/Internal/DecisionRow`): the pending line, the
 * unavailable reason and a failure's error in the small type (Oddkin/Small), the error in the danger
 * colour; the outcome in the field's small type (Oddkin/Component/Field/small) and its tone's colour,
 * secondary when neutral.
 */
export const decisionRowStyles = css`
  :is(.pending, .decision-reason, .decision-error, .outcome) {
    margin: 0;
    color: ${token('color.text.secondary')};
  }
  :is(.pending, .decision-reason, .decision-error) {
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    letter-spacing: ${token('type.small.letter-spacing')};
    line-height: ${token('type.small.line-height')};
  }
  .outcome {
    font-size: ${token('font.size.sm')};
    font-weight: ${token('font.weight.regular')};
    letter-spacing: ${token('letter-spacing.normal')};
    line-height: ${token('line-height.normal')};
  }
  :is(.decision-error, .outcome[data-tone='danger']) {
    color: ${token('color.danger.foreground')};
  }
  .outcome[data-tone='success'] {
    color: ${token('color.success.foreground')};
  }
`;
