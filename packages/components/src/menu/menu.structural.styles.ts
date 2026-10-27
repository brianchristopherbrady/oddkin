import { css } from '@oddkin/core/styles';

/**
 * The menu is an inline box holding its trigger; the menu and its submenus are popover surfaces
 * (the overlay-surface module) that lay their rows out in a column, at least as wide as the
 * trigger. Usable items take the pointer cursor, as buttons do. The empty `point` a context menu
 * opens against is fixed at the pointer (its insets set from script, in viewport pixels). No brand
 * tokens.
 */
export const menuStructuralStyles = css`
  :host {
    display: inline-block;
    vertical-align: middle;
  }
  .trigger-glyph {
    display: inline-flex;
  }
  .point {
    position: fixed;
    inset-block-start: var(--_point-block);
    inset-inline-start: var(--_point-inline);
  }
  .menu {
    min-inline-size: var(--_anchor-inline-size, auto);
  }
  .menu .option:not([aria-disabled='true']) {
    cursor: pointer;
  }
  .separator {
    block-size: 0;
  }
`;
