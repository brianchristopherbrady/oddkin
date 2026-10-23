import { html } from '@oddkin/core/template';
import { closeGlyph } from '../styles/glyphs.js';
import type { OddkinChip } from './chip.js';

/** Anatomy: `part="base"` with the default slot and, when `removable`, `part="remove"` (a button). */
export const chipTemplate = (chip: OddkinChip) =>
  html`<span part="base" class="chip"
    ><span class="label"><slot></slot></span>${
      chip.removable
        ? html`<button
            part="remove"
            class="remove"
            type="button"
            aria-label=${chip._removeLabel}
            ?disabled=${chip.disabled}
            @click=${chip._onRemove}
            @keydown=${chip._onKeydown}
          >
            ${closeGlyph}
          </button>`
        : null
    }</span
  >`;
