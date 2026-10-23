import { css } from '@oddkin/core/styles';

/**
 * Overlay surfaces (component-catalog.md §6 "overlay-surface"), shared by every overlay: an inner
 * `[popover]` or `<dialog>` with `class="overlay-surface"` (menus, listboxes, combobox surfaces,
 * dialogs), or a host that is itself the popover (`odd-popover`, `odd-tooltip`, `odd-toast`). It
 * replaces the browser's popover and dialog padding and scrolls a non-modal dialog as a modal one
 * does (border-box sizing comes from `hostStyles`). The browser's solid border stays, and forced
 * colours draw it in `CanvasText`. Token-free; the look is `overlaySurfaceStyles`.
 */
export const overlaySurfaceStructuralStyles = css`
  .overlay-surface,
  :host([popover]) {
    padding: 0;
    overflow: auto;
  }
`;
