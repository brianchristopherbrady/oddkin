import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default validation summary: Figma `ValidationSummary` (danger surface with a danger
 * border, `control/radius`, UI heading in the danger colour, Body links in the link colour).
 */
export const validationSummaryStyles = css`
  .summary {
    padding: ${token('space.md')};
    border: ${token('border.width.default')} solid var(--_tone-foreground);
    border-radius: ${token('control.radius')};
    background: var(--_tone-surface);
    color: ${token('color.text.primary')};
  }
  .marker,
  .label {
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
  .link {
    color: ${token('color.link')};
    font-family: ${token('type.body.family')};
    font-size: ${token('type.body.size')};
    font-weight: ${token('type.body.weight')};
    line-height: ${token('type.body.line-height')};
    text-decoration-line: underline;
    text-underline-offset: 0.2em;
  }
`;
