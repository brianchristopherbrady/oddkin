import { html } from '@oddkin/core/template';
import { checkGlyph, copyGlyph } from '../styles/glyphs.js';
import type { OddkinCopyButton } from './copy-button.js';

/**
 * Anatomy: `part="base"` holding `part="button"` (a native button with the button look), the
 * outcome `part="status"`, `part="fallback"` (shown after a failure without a source element;
 * both hidden while unused), and two empty live regions for the announcements.
 */
export const copyButtonTemplate = (el: OddkinCopyButton) => {
  const status = el._status.value;
  const message = el._message;
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
    ><span part="status" class="status" data-status=${status} ?hidden=${!message}>${message}</span
    ><input
      part="fallback"
      class="fallback"
      readonly
      aria-label=${el._label}
      ?hidden=${!fallback}
      .value=${fallback} /><span
      class="visually-hidden polite"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    ></span
    ><span class="visually-hidden assertive" aria-live="assertive" aria-atomic="true"></span
  ></span>`;
};
