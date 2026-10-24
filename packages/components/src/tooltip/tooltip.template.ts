import { html } from '@oddkin/core/template';
import type { OddkinTooltip } from './tooltip.js';

/** Anatomy: the host is the surface (`popover="manual"`, the shared anchored look); `part="base"` holds the text. */
export const tooltipTemplate = (_tooltip: OddkinTooltip) =>
  html`<div part="base" class="tooltip"><slot></slot></div>`;
