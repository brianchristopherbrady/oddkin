import { html } from '@oddkin/core/template';
import { closeButton } from '../overlay/overlay.js';
import type { OddkinPopover } from './popover.js';

/**
 * Anatomy: the host is the surface (the shared overlay look on `:host([popover])`); inside,
 * `part="base"` holds the content and, unless `no-close`, the `close` button at the inline end.
 */
export const popoverTemplate = (popover: OddkinPopover) =>
  html`<div part="base" class="popover">
    <div class="content"><slot></slot></div>
    ${popover.noClose ? '' : closeButton(popover._strings.value.close, () => popover.close())}
  </div>`;
