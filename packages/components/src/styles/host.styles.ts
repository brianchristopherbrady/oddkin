import { css } from '@oddkin/core/styles';

/**
 * Host defaults every Oddkin component shares: border-box sizing inside the shadow root, and the
 * `hidden` attribute always hiding the host and internal elements, even where a rule sets
 * `display`. The only `!important` declarations Oddkin ships; they cannot leave the shadow root.
 * Structural: no tokens.
 */
export const hostStyles = css`
  :host {
    box-sizing: border-box;
  }
  :host([hidden]) {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  [hidden] {
    display: none !important;
  }
`;
