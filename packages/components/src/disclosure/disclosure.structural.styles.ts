import { css } from '@oddkin/core/styles';

/**
 * A summary row (text, then the chevron at the inline end) above the content. Disclosures joined
 * in a group share their borders. No brand or visual tokens.
 */
export const disclosureStructuralStyles = css`
  :host {
    display: block;
  }
  .summary {
    display: flex;
    align-items: center;
    list-style: none;
    cursor: pointer;
  }
  .summary:focus-visible {
    outline: none;
  }
  .label {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .marker {
    display: inline-flex;
    flex: none;
  }
  .content {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  :host([disabled]) .summary {
    cursor: not-allowed;
  }
  :host(:state(joined-start)) .disclosure {
    border-block-start-width: 0;
    border-start-start-radius: 0;
    border-start-end-radius: 0;
  }
  :host(:state(joined-end)) .disclosure {
    border-block-end-width: 0;
    border-end-start-radius: 0;
    border-end-end-radius: 0;
  }
  @media (forced-colors: active) {
    .disclosure {
      border-color: CanvasText;
    }
    /* Above the skin's disabled colour. */
    :host([disabled]) .details > .summary {
      color: GrayText;
    }
  }
`;
