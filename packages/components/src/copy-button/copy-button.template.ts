import { html } from '@oddkin/core/template';
import { checkGlyph, copyGlyph } from '../styles/glyphs.js';
import type { OddkinCopyButton } from './copy-button.js';

/**
 * Anatomy: `part="base"` holding `part="button"` (a native button with the button look), the
 * failure `part="status"`, `part="fallback"` (shown after a failure without a source element, a
 * text area when the text has line breaks; both hidden while unused), `part="confirmation"` (a
 * manual popover with the overlay look, hidden from assistive technology), and two empty live
 * regions for the announcements no surrounding announcer takes.
 */
export const copyButtonTemplate = (el: OddkinCopyButton) => {
  const status = el._status.value;
  const t = el._strings;
  const fallback = el._fallback.value;
  return html`<span part="base" class="base"
    ><button
      part="button"
      class="odd-button"
      data-size="sm"
      type="button"
      ?disabled=${el.disabled}
      @click=${el._onClick}
    >
      ${status === 'copied' ? checkGlyph : copyGlyph}<span>${el._label}</span></button
    ><span part="status" class="status" ?hidden=${status !== 'failed'}
      >${status === 'failed' ? t.failed : ''}</span
    >${
      fallback.includes('\n')
        ? html`<textarea
            part="fallback"
            class="fallback"
            readonly
            wrap="off"
            rows=${Math.min(fallback.split('\n').length, 8)}
            aria-label=${el._label}
            .value=${fallback}
          ></textarea>`
        : html`<input
            part="fallback"
            class="fallback"
            readonly
            aria-label=${el._label}
            ?hidden=${!fallback}
            .value=${fallback}
          />`
    }<span
      part="confirmation"
      class="overlay-surface confirmation"
      popover="manual"
      aria-hidden="true"
      >${t.copied}</span
    ><span class="visually-hidden polite" role="status" aria-live="polite" aria-atomic="true"></span
    ><span class="visually-hidden assertive" aria-live="assertive" aria-atomic="true"></span
  ></span>`;
};
