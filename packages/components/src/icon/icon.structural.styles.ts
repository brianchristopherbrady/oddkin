import { css } from '@oddkin/core/styles';

/**
 * The icon box and the mask that draws `src` in `currentColor`; a slotted `<svg>` fills the box.
 * In forced colours the mask takes the system text colour. No brand or visual tokens.
 */
export const iconStructuralStyles = css`
  :host {
    display: inline-block;
    flex: none;
    vertical-align: middle;
    line-height: 0;
  }
  .icon,
  .mask {
    display: block;
    inline-size: var(--_icon-size, 1em);
    block-size: var(--_icon-size, 1em);
  }
  .mask {
    background-color: currentColor;
    mask: var(--_icon-src) center / contain no-repeat;
  }
  ::slotted(svg) {
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }
  /* Forced colours replace a currentColor background with Canvas; a system colour is kept. */
  @media (forced-colors: active) {
    .mask {
      background-color: CanvasText;
    }
  }
`;
