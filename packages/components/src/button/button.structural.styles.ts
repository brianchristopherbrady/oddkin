import { css } from '@mote/core/styles';

/**
 * Styles the button's layout and interaction depend on: host display, full width, content
 * alignment, the loading indicator, and forced-colors borders. No brand or visual tokens.
 * Keep these when replacing the visual styles; they do not make arbitrary overrides safe.
 */
export const buttonStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  :host([full-width]) {
    display: block;
  }
  :host([hidden]) {
    display: none;
  }
  button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: auto;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: center;
    cursor: pointer;
  }
  :host([full-width]) button {
    inline-size: 100%;
  }
  button:disabled,
  button[aria-disabled='true'] {
    cursor: not-allowed;
  }
  .label {
    display: inline-flex;
    align-items: center;
    min-inline-size: 0;
  }
  .spinner:not([hidden]) {
    display: inline-block;
    flex: none;
    inline-size: 1em;
    block-size: 1em;
    border: 0.15em solid currentColor;
    border-inline-end-color: transparent;
    border-radius: 50%;
    animation: mote-button-spin 0.8s linear infinite;
  }
  @keyframes mote-button-spin {
    to {
      transform: rotate(1turn);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner:not([hidden]) {
      animation-duration: 3s;
    }
  }
  @media (forced-colors: active) {
    button {
      border: 1px solid ButtonText;
    }
    button:disabled {
      color: GrayText;
      border-color: GrayText;
    }
  }
`;
