import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

/** Oddkin's default placeholder look: Figma `skeleton` (`color/border/default`, `radius/sm`). */
export const skeletonStyles = css`
  .line,
  .block {
    border-radius: ${token('radius.sm')};
    background: var(--odd-skeleton-color, ${token('color.border.default')});
  }
  :host([shape='circle']) .block {
    border-radius: ${token('radius.full')};
  }
`;
