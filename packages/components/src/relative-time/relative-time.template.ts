import { html } from '@oddkin/core/template';
import { clockGlyph } from '../styles/glyphs.js';
import type { OddkinRelativeTime } from './relative-time.js';

/**
 * Anatomy: `part="base"` holding the clock glyph and `part="time"` (a `<time>`, or the unavailable
 * text), and, with `detail`, `part="detail"`.
 */
export const relativeTimeTemplate = (el: OddkinRelativeTime) => {
  const date = el._date;
  const absolute = date ? el._absolute(date) : '';
  return html`<span part="base" class="base"
    ><span class="relative"
      >${clockGlyph}${
        date
          ? html`<time part="time" class="time" datetime=${el.datetime} title=${absolute}
              >${el._relative(date)}</time
            >`
          : html`<span part="time" class="time">${el._unavailable}</span>`
      }</span
    >${el.detail && date ? html`<span part="detail" class="detail">${absolute}</span>` : null}</span
  >`;
};
