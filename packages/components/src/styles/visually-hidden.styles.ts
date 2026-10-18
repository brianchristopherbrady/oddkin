import { css } from '@oddkin/core/styles';

/**
 * `.visually-hidden`: text that assistive technology reads but that takes no visual space
 * (status text, labels for icon-only controls). Structural: no tokens.
 */
export const visuallyHiddenStyles = css`
  .visually-hidden {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
`;
