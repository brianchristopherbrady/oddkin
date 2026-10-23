import { OddkinElement, prop } from '@oddkin/core/element';
import type { Scope } from '@oddkin/core/scope';
import { TONES } from '../styles/tone.styles.js';

/**
 * A persistent inline message about the page or a region: a tone glyph, a title, a message, and
 * optional actions. It stays until the situation changes; a passing result belongs in a toast.
 *
 * @slot - The message.
 * @slot end - Actions, such as "Try again".
 * @csspart base - The surface.
 * @csspart marker - The tone glyph.
 * @csspart label - The title.
 * @cssprop --odd-alert-radius - Corner radius.
 * @a11y Read in place. With `announce`, it is an ARIA alert, so inserting it or changing its text is announced at once; use that only for urgent, new information.
 * @previewRole alert
 * @useFor Errors and warnings that affect a page or region, confirmations that must stay visible.
 * @notFor Field errors (use the field's `error`); passing results (a toast); counts and labels (use odd-badge).
 * @category Feedback
 */
export class OddkinAlert extends OddkinElement.with({
  tone: prop.enum(TONES, {
    default: 'neutral',
    reflect: true,
    description: 'Meaning colour and glyph.',
  }),
  label: prop.string({ default: '', description: 'The title, shown above the message.' }),
  announce: prop.enum(['none', 'important'], {
    default: 'none',
    empty: 'important',
    description: 'Announces the alert when it appears or changes (`role="alert"`).',
  }),
}) {
  protected override mounted(scope: Scope): void {
    scope.effect(() => {
      this.internals.role = this.announce === 'important' ? 'alert' : null;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-alert': OddkinAlert;
  }
}
