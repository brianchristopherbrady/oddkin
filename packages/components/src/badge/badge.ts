import { OddkinElement, prop } from '@oddkin/core/element';
import { TONES } from '../styles/tone.styles.js';

/**
 * A passive status or count: words with a tone colour and a glyph, so the meaning never rests on
 * colour alone. Not an action; do not make it clickable.
 *
 * @slot - The text.
 * @csspart base - The surface.
 * @csspart marker - The tone glyph (hidden with `no-marker`).
 * @cssprop --odd-badge-radius - Corner radius.
 * @a11y Read in place as text; it has no role. Put the meaning in the words ("Failed", "3 new"), not only in the tone.
 * @previewRole badge
 * @useFor Short status labels and counts next to the thing they describe.
 * @notFor Actions or filters (use a button); messages that need attention (use an alert).
 * @category Feedback
 */
export class OddkinBadge extends OddkinElement.with({
  tone: prop.enum(TONES, {
    default: 'neutral',
    reflect: true,
    description: 'Meaning colour and glyph.',
  }),
  noMarker: prop.boolean({
    attribute: 'no-marker',
    reflect: true,
    description: 'Hides the tone glyph, as for a count.',
  }),
}) {}

declare global {
  interface HTMLElementTagNameMap {
    'odd-badge': OddkinBadge;
  }
}
