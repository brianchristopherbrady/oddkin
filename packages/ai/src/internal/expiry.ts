import { html } from '@oddkin/core/template';
import { format, formatTime, langOf } from './strings.js';

/** From five minutes before `expiresAt`, the expiry reads as soon (owner, 2026-11-09). */
const SOON = 5 * 60 * 1000;

/**
 * Figma page 08's Expiry (`Oddkin/AI/Internal/Expiry`): when a request expires, as an `odd-badge`
 * worded by `text` (`{time}`), a warning from five minutes before while the request is `open`;
 * omitted when absent or unformattable. Presentation only: nothing counts down, and only the record
 * says it expired.
 */
export const expiryBadge = (host: Element, iso: string | undefined, text: string, open = true) => {
  const time = formatTime(iso, langOf(host));
  if (!time) return null;
  const soon = open && Date.parse(iso!) - Date.now() <= SOON;
  return html`<odd-badge class="expiry" tone=${soon ? 'warning' : 'neutral'}
    >${format(text, { time })}</odd-badge
  >`;
};
