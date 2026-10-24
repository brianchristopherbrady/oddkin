import { css } from '@oddkin/core/styles';

/**
 * The heading row (glyph and heading) above the list, in one column that wraps long text. No
 * brand or visual tokens.
 */
export const validationSummaryStructuralStyles = css`
  :host {
    display: block;
  }
  .summary {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .header {
    display: flex;
    align-items: flex-start;
  }
  .marker {
    display: inline-flex;
    flex: none;
  }
  .label {
    margin: 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
`;
