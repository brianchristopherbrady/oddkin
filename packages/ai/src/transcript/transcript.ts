import { OddkinElement, prop, type ElementEvents } from '@oddkin/core/element';
import type { TranscriptSegment } from '../contracts/types.js';
import { transcriptChangeEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export const TRANSCRIPT_STRINGS = {
  label: 'Transcript',
  listening: 'Hearing',
  empty: 'Nothing transcribed yet.',
  edit: 'Edit segment {index}',
};

/**
 * A transcript with final segments (optionally editable) and interim text that may still change.
 *
 * @csspart list - Final segments.
 * @csspart interim - Interim text.
 * @a11y Not a live region: interim text changes constantly. Final segments are ordinary text or labelled text areas when editable.
 * @keyboard Editable segments are native text areas.
 * @useFor Showing and correcting speech-to-text results.
 * @notFor Chat transcripts; use the conversation.
 * @category AI
 */
export class OddkinTranscript extends OddkinElement.with({
  segments: prop.array<TranscriptSegment>({ description: 'Final (and interim) segments.' }),
  interim: prop.string({ default: '', attribute: false, description: 'Current interim text.' }),
  editable: prop.boolean({ reflect: true, description: 'Final segments can be corrected.' }),
  strings: prop.object<Partial<typeof TRANSCRIPT_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'transcript-change': transcriptChangeEvent };
  declare readonly _events?: ElementEvents<typeof OddkinTranscript>;

  /** @internal */
  get _strings(): typeof TRANSCRIPT_STRINGS {
    return strings(TRANSCRIPT_STRINGS, this.strings);
  }

  /** @internal */
  readonly _onEdit = (event: Event): void => {
    const area = event.target as HTMLTextAreaElement;
    const segmentId = area.dataset['id'];
    if (segmentId) this.emit(transcriptChangeEvent, { segmentId, text: area.value });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-transcript': OddkinTranscript;
  }
}
