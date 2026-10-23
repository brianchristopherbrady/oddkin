import { css } from '@oddkin/core/styles';

/**
 * A row of tabs above the panels (a column beside them when vertical); tabs wrap rather than
 * overflow. No brand or visual tokens.
 */
export const tabsStructuralStyles = css`
  :host {
    display: block;
  }
  .tabs {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  .list {
    display: flex;
    flex-wrap: wrap;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: center;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .tab:disabled {
    cursor: not-allowed;
  }
  .panels {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .panels::before {
    content: '';
    flex: none;
  }
  .panel {
    min-inline-size: 0;
  }
  :host([orientation='vertical']) .tabs,
  :host([orientation='vertical']) .panels {
    flex-direction: row;
  }
  :host([orientation='vertical']) .list {
    flex: none;
    flex-direction: column;
    flex-wrap: nowrap;
    max-inline-size: 40%;
  }
  :host([orientation='vertical']) .panel {
    flex: 1 1 auto;
  }
  @media (forced-colors: active) {
    .tabs {
      border-color: CanvasText;
    }
    .tabs .tab[aria-selected='true'] {
      background: Highlight;
      color: HighlightText;
    }
    .tabs .tab:disabled {
      color: GrayText;
    }
  }
`;
