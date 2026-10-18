import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const activityStyles = css`
  .base {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${token('space.xs')};
    min-block-size: ${token('target.min')};
    color: ${token('color.text.secondary')};
    font-size: ${token('font.size.sm')};
  }
  .base[data-status='failed'] {
    color: ${token('color.text.danger')};
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
`;
