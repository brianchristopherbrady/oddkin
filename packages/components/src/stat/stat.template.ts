import { html } from '@oddkin/core/template';
import { arrowUpGlyph } from '../styles/glyphs.js';
import type { OddkinStat } from './stat.js';

/**
 * Anatomy: `part="base"` holding `part="label"`, then `part="value"` and `part="context"` (the
 * trend arrow and the default slot), or, while loading, `part="placeholder"` and the loading words.
 */
export const statTemplate = (stat: OddkinStat) => {
  const words = stat._strings;
  return html`<div part="base" class="base">
    <span part="label" class="label">${stat.label}</span>
    ${
      stat.loading
        ? html`<odd-skeleton part="placeholder" class="placeholder" shape="rect"></odd-skeleton
            ><span part="context" class="context">${words.loading}</span>`
        : stat.value
          ? html`<span part="value" class="value">${stat.value}</span
              ><span part="context" class="context"
                >${stat.trend === 'none' ? null : arrowUpGlyph}<slot></slot
              ></span>`
          : html`<span part="value" class="value" aria-hidden="true">—</span
              ><span part="context" class="context">${words.unavailable}</span>`
    }
  </div>`;
};
