import { css } from '@oddkin/core/styles';

/**
 * Styles the button's layout and interaction depend on: host display, full width, content
 * alignment, the loading overlay (the ring itself is `spinnerStyles`), and forced-colors borders.
 * While loading, the spinner turns at the centre over the content, which keeps its size and
 * accessible name but is not drawn; a pressed toggle stays pressed in forced colours.
 * No brand or visual tokens. Keep these (after `hostStyles`) when replacing the visual styles;
 * they do not make arbitrary overrides safe.
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
    position: relative;
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
  .spinner {
    position: absolute;
    inset: 0;
    margin: auto;
  }
  :host([loading]) .label,
  :host([loading]) ::slotted(*) {
    opacity: 0;
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
      button[aria-pressed='true'][aria-pressed='true']:enabled:not([aria-disabled='true']),
    :host([toggle]) button[aria-pressed='true'][aria-pressed='true'][aria-disabled='true'] {
      border-color: Highlight;
      background: Highlight;
      color: HighlightText;
    }
  }
`;
