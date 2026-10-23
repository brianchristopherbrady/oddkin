import { css } from '@oddkin/core/styles';

/** A centred column; the media circle centres its content. No brand or visual tokens. */
export const emptyStateStructuralStyles = css`
  :host {
    display: block;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .media:not([hidden]) {
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .label {
    margin: 0;
  }
  .footer:not([hidden]) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }
`;
