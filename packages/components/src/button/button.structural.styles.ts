import { css } from '@oddkin/core/styles';

/**
 * Styles the button's layout and interaction depend on: host display, full width, content
 * alignment, and forced-colors borders (the loading indicator is `spinnerStyles`). No brand or
 * visual tokens. Keep these (after `hostStyles`) when replacing the visual styles; they do not make
 * arbitrary overrides safe.
 */
export const buttonStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  :host([full-width]) {
    display: block;
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
    /* Long unbroken labels (URLs, compound words, translations) wrap instead of overflowing. */
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    button {
      border: 1px solid ButtonText;
    }
    button:disabled {
      color: GrayText;
      border-color: GrayText;
    }
    /* The pressed state twice: one attribute more than the skin's pressed rule, so the system
       colours win. */
    :host([toggle])
      button[aria-pressed='true'][aria-pressed='true']:enabled:not([aria-disabled='true']) {
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }
  }
`;
