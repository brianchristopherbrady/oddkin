import { css } from '@oddkin/core/styles';

/**
 * Overlay surfaces (component-catalog.md §6 "overlay-surface"), shared by every overlay: an inner
 * `[popover]` or `<dialog>` with `class="overlay-surface"` (menus, listboxes, combobox surfaces,
 * dialogs), or a host that is itself the popover (`odd-popover`, `odd-tooltip`, `odd-toast`). It
 * replaces the browser's popover and dialog padding and scrolls a non-modal dialog as a modal one
 * does (border-box sizing comes from `hostStyles`). The browser's solid border stays, and forced
 * colours draw it in `CanvasText`. An anchored popover stays within the room its placement leaves
 * (`--_overlay-max-inline-size` and `-block-size`, written by the overlay wiring; the viewport
 * otherwise). `.overlay-close` is the explicit close control of every dismissible surface.
 * Token-free; the look is `overlaySurfaceStyles`.
 */
export const overlaySurfaceStructuralStyles = css`
  .overlay-surface,
  :host([popover]) {
    padding: 0;
    overflow: auto;
  }
  [popover].overlay-surface,
  :host([popover]) {
    max-inline-size: var(--_overlay-max-inline-size, 100%);
    max-block-size: var(--_overlay-max-block-size, 100%);
  }
  .overlay-close {
    display: inline-grid;
    flex: none;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
`;
