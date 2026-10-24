import { css } from '@oddkin/core/styles';
import { html } from '@oddkin/core/template';

/**
 * The indeterminate busy indicator every loading state draws (`odd-button` while loading,
 * `odd-spinner`, loading rows): a 1em ring in `currentColor` with a gap, turning once per 0.8 s,
 * slowed under reduced motion. Elements recolour it with `border-color`. Structural: no tokens.
 */
export const spinnerStyles = css`
  .spinner:not([hidden]) {
    display: inline-block;
    flex: none;
    inline-size: 1em;
    block-size: 1em;
    border: 0.15em solid currentColor;
    border-inline-end-color: transparent;
    border-radius: 50%;
    animation: odd-spin 0.8s linear infinite;
  }
  @keyframes odd-spin {
    to {
      transform: rotate(1turn);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner:not([hidden]) {
      animation-duration: 3s;
    }
  }
`;

/** The busy ring beside a loading row's text; decorative, as the text says what is happening. */
export const spinnerTemplate = html`<span class="spinner" aria-hidden="true"></span>`;
