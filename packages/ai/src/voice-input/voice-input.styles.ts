import { css } from '@oddkin/core/styles';
import { token } from '@oddkin/tokens/refs';

export const voiceInputStyles = css`
  .base {
    display: grid;
    gap: ${token('space.xs')};
  }
  .record {
    display: inline-flex;
    align-items: center;
    gap: ${token('space.xs')};
  }
  .dot {
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: ${token('radius.full')};
    background: ${token('color.text.secondary')};
  }
  .record[aria-pressed='true'] .dot {
    background: ${token('color.danger.foreground')};
    animation: odd-voice-pulse 1s ease-in-out infinite;
  }
  @keyframes odd-voice-pulse {
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .record[aria-pressed='true'] .dot {
      animation: none;
    }
  }
  .status-text {
    margin: 0;
    font-size: ${token('font.size.sm')};
    color: ${token('color.text.secondary')};
  }
  .status-text:is(
    [data-status='denied'],
    [data-status='unavailable'],
    [data-status='interrupted'],
    [data-status='error']
  ) {
    color: ${token('color.danger.foreground')};
  }
  @media (forced-colors: active) {
    .dot {
      background: CanvasText;
    }
  }
`;
