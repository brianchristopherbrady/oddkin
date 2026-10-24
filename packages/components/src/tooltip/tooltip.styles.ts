import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default tooltip: Figma `tooltip` (the anchored surface from the overlay-surface module, the UI text style). */
export const tooltipStyles = css`
  .tooltip {
    padding: ${token('space.xs')} ${token('space.sm')};
    color: ${token('color.text.primary')};
    font-family: ${token('type.ui.family')};
    font-size: ${token('type.ui.size')};
    font-weight: ${token('type.ui.weight')};
    line-height: ${token('type.ui.line-height')};
    letter-spacing: ${token('type.ui.letter-spacing')};
  }
`;
