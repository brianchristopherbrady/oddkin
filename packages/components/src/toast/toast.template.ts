import { html } from '@oddkin/core/template';
import { closeButton } from '../overlay/overlay.js';
import { toneGlyph } from '../styles/tone.styles.js';
import type { OddkinToast } from './toast.js';

/**
 * Anatomy: the host is the surface (`popover="manual"`) and the live region; `part="base"` lays
 * out the `marker` glyph, the `label` title, the `close` button, and under the title the default
 * slot and the `end` slot for the action, as Figma `toast` does. The title and the message stay
 * out of the accessibility tree until just after it shows, so they are announced.
 */
export const toastTemplate = (toast: OddkinToast) => {
  const hidden = toast._revealed.value ? null : 'true';
  return html`<div part="base" class="toast">
    <span part="marker" class="marker">${toneGlyph(toast.tone)}</span>
    <p part="label" class="label" aria-hidden=${hidden} ?hidden=${!toast.label}>${toast.label}</p>
    <div class="message" aria-hidden=${hidden}><slot></slot></div>
    <div class="end"><slot name="end"></slot></div>
    ${closeButton(toast._strings.value.close, () => toast.close())}
  </div>`;
};
