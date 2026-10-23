import { css } from '@oddkin/core/styles';

/**
 * The bar fills to `--_progress` (0–1) from the inline start; without a value a third of the bar
 * slides along it, and stands still, at full width and faint, under reduced motion. No brand or
 * visual tokens.
 */
export const progressStructuralStyles = css`
  :host {
    display: block;
  }
  .progress {
    display: grid;
    min-inline-size: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .track {
    position: relative;
    overflow: hidden;
  }
  .indicator {
    block-size: 100%;
    inline-size: calc(var(--_progress, 0) * 100%);
  }
  .indeterminate .indicator {
    inline-size: 33%;
    animation: odd-progress-slide 1.6s ease-in-out infinite;
  }
  @keyframes odd-progress-slide {
    from {
      translate: -100% 0;
    }
    to {
      translate: 300% 0;
    }
  }
  .indeterminate .indicator:dir(rtl) {
    animation-direction: reverse;
  }
  @media (prefers-reduced-motion: reduce) {
    .indeterminate .indicator {
      inline-size: 100%;
      opacity: 0.4;
      animation: none;
    }
  }
  @media (forced-colors: active) {
    .track {
      border: 1px solid CanvasText;
    }
    .indicator {
      background: Highlight;
    }
  }
`;
