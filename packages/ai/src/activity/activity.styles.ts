import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';
import { activityRecipeStyles } from './activity.recipe.styles.js';

/** The arrangement is the layout recipe in `activity.recipe.ts`. */
export const activityStyles = css`
  ${activityRecipeStyles}
  .base {
    min-block-size: ${token('control.height.lg')};
  }
  .base[data-status='failed'] {
    color: ${token('color.danger.foreground')};
  }
  .indicator {
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: ${token('radius.full')};
    background: currentColor;
    animation: odd-activity-pulse 1.2s ease-in-out infinite;
  }
  @keyframes odd-activity-pulse {
    50% {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .indicator {
      animation: none;
    }
  }
  .text {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .detail {
    font-size: ${token('type.small.size')};
    font-weight: ${token('type.small.weight')};
    line-height: ${token('type.small.line-height')};
    letter-spacing: ${token('type.small.letter-spacing')};
    color: ${token('color.text.secondary')};
  }
`;
