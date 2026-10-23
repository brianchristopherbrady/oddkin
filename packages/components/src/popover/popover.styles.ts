import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/**
 * Oddkin's default popover: Figma `popover` (the shared anchored surface from the overlay-surface
 * module, `space.md` inside, the close glyph in the corner).
 */
export const popoverStyles = css`
  .popover {
    gap: ${token('space.xs')};
    max-inline-size: var(--odd-popover-max-inline-size, 20rem);
    padding: ${token('space.md')};
  }
  .overlay-close {
    margin-block-start: calc(-1 * ${token('space.xs')});
    margin-inline-end: calc(-1 * ${token('space.xs')});
  }
`;
