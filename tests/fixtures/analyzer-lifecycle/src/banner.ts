import { OddkinElement, event, prop } from '@oddkin/core';

/**
 * Fired when the banner closes.
 * @deprecated Listen for `acme-dismiss` instead; it carries the reason.
 * @replacement acme-dismiss
 * @since 1.0.0
 */
export const closeEvent = event('acme-close', { bubbles: true, composed: true, cancelable: false });
/** Fired when the user dismisses the banner. */
export const dismissEvent = event<{ reason: string }>('acme-dismiss', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
});

/**
 * A page banner.
 *
 * @slot - The message.
 * @csspart body - The message area.
 * @cssprop --acme-banner-gap - Space between the icon and the message.
 * @since 1.0.0
 * @customization 1 2
 */
export class AcmeBanner extends OddkinElement.with({
  /**
   * @deprecated Use `tone`; `kind` maps to the same values.
   * @replacement tone
   * @migration migrations/2.0.md#banner-kind
   */
  kind: prop.enum(['info', 'warning'], { default: 'info', reflect: true }),
  tone: prop.enum(['info', 'warning'], { default: 'info', reflect: true }),
}) {
  static override events = { close: closeEvent, dismiss: dismissEvent };
}
customElements.define('acme-banner', AcmeBanner);

/**
 * The 1.x notice; replaced by the banner.
 *
 * @deprecated Use `<acme-banner>`.
 * @replacement acme-banner
 * @migration migrations/2.0.md#notice
 * @since 0.3.0
 * @customization 1 9
 */
export class AcmeNotice extends OddkinElement {}
customElements.define('acme-notice', AcmeNotice);
