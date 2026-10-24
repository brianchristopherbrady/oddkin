import { css } from '@oddkin/core/styles';

/** The text wraps at a readable width. The host keeps the browser's popover display rules. No brand or visual tokens. */
export const tooltipStructuralStyles = css`
  .tooltip {
    max-inline-size: var(--odd-tooltip-max-inline-size, 16rem);
    overflow-wrap: anywhere;
  }
`;
