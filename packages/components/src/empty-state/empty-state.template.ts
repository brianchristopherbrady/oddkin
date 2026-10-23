import { html } from '@oddkin/core/template';
import type { OddkinEmptyState } from './empty-state.js';

/** Anatomy: `part="base"` column of `media`, `label`, the default slot, and `footer`. */
export const emptyStateTemplate = (state: OddkinEmptyState) =>
  html`<div part="base" class="empty">
    <div part="media" class="media" ?hidden=${!state._hasMedia.value}>
      <slot name="media" @slotchange=${state._onSlotChange}></slot>
    </div>
    <p part="label" class="label" ?hidden=${!state.label}>${state.label}</p>
    <div class="body"><slot></slot></div>
    <div part="footer" class="footer" ?hidden=${!state._hasFooter.value}>
      <slot name="footer" @slotchange=${state._onSlotChange}></slot>
    </div>
  </div>`;
