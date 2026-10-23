import { html } from '@oddkin/core/template';
import type { OddkinToolbar } from './toolbar.js';

/** Anatomy: `part="base"` around the default slot. */
export const toolbarTemplate = (toolbar: OddkinToolbar) =>
  html`<div part="base" class="toolbar"><slot @slotchange=${toolbar._onSlotChange}></slot></div>`;
