import { css } from '@oddkin/core/styles';

/**
 * Placeholder geometry: text lines one line box apart (the last of several shorter), or a block
 * that fills the element (rect 4 rem tall and circle 2.5 rem wide unless sized with CSS). The
 * pulse stops under reduced motion. No brand or visual tokens.
 */
export const skeletonStructuralStyles = css`
  :host {
    display: block;
  }
  :host([shape='rect']) {
    block-size: 4rem;
  }
  :host([shape='circle']) {
    display: inline-block;
    inline-size: 2.5rem;
    aspect-ratio: 1;
  }
  .lines {
    display: grid;
    gap: 0.5em;
  }
  .line {
    display: block;
    block-size: 1em;
  }
  .line:last-child:not(:first-child) {
    inline-size: 60%;
  }
  .block {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  .line,
  .block {
    animation: odd-skeleton-pulse 1.6s ease-in-out infinite alternate;
  }
  @keyframes odd-skeleton-pulse {
    to {
      opacity: 0.5;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .line,
    .block {
      animation: none;
    }
  }
  @media (forced-colors: active) {
    .line,
    .block {
      border: 1px solid GrayText;
    }
  }
`;
