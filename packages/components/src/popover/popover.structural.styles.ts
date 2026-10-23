import { css } from '@oddkin/core/styles';

/**
 * The content beside the close button, which sits at the inline-end top corner. The host keeps
 * the browser's popover display rules (never set `display` on it). No brand or visual tokens.
 */
export const popoverStructuralStyles = css`
  .popover {
    display: flex;
    align-items: flex-start;
  }
  .content {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
`;
