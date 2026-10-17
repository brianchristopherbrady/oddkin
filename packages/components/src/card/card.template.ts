import { html } from '@mote/core/template';
import type { MoteCard } from './card.js';

/**
 * Anatomy: `part="base"` surface containing `header`, `body`, and `footer` parts with the
 * `header`, default, and `footer` slots. Empty header and footer are hidden. Slot changes
 * must call `_onSlotChange` so naming and visibility stay correct.
 */
export const cardTemplate = (card: MoteCard) =>
  html`<div part="base" class="card">
    <div part="header" class="header" ?hidden=${!card._hasHeader.value}>
      <slot name="header" @slotchange=${card._onSlotChange}></slot>
    </div>
    <div part="body" class="body"><slot></slot></div>
    <div part="footer" class="footer" ?hidden=${!card._hasFooter.value}>
      <slot name="footer" @slotchange=${card._onSlotChange}></slot>
    </div>
  </div>`;
