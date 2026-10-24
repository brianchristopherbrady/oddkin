import { css } from '@oddkin/core/styles';

/**
 * The group is a block; its legend, description, and error use the shared field layout. The
 * options stack, or line up and wrap (`orientation="horizontal"`); a group of options stacks its
 * heading and options. The radio's dot is centred in the round box and shows when checked. No
 * brand tokens.
 */
export const radioGroupStructuralStyles = css`
  :host {
    display: block;
  }
  .options,
  .group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: inherit;
  }
  :host([orientation='horizontal']) .options {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .indicator-dot {
    inline-size: 40%;
    block-size: 40%;
  }
  .indicator-box:checked ~ .indicator-dot {
    visibility: visible;
  }
`;
