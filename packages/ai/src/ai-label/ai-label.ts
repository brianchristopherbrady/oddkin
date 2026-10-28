import { OddkinElement, prop } from '@oddkin/core/element';
import type { Provenance } from '../contracts/types.js';
import { strings } from '../internal/strings.js';

export const AI_LABEL_STRINGS = {
  generated: 'AI generated',
  assisted: 'AI assisted',
  edited: 'Edited by a person',
  human: 'Written by a person',
  model: 'Model',
  provider: 'Provider',
  generatedAt: 'Generated',
  disclaimer: 'Information supplied by the application; not independently verified.',
};

/**
 * A provenance label for generated or assisted content, with the origin details the application
 * supplied in a native disclosure. Shows information as supplied; it never asserts accuracy.
 *
 * @csspart base - The native disclosure around the label and its details.
 * @csspart label - The visible label (the disclosure summary).
 * @csspart details - The origin details.
 * @a11y The label is a native `<summary>`; its details are read in document order when expanded.
 * @keyboard Enter or Space toggles the details (native disclosure).
 * @useFor Marking responses, artifacts, or edits as AI generated or assisted, with origin details.
 * @notFor Asserting factual accuracy or safety; use the host's own review states.
 * @limitation Labels and details are application-supplied; nothing is inferred from content.
 * @category AI
 */
export class OddkinAiLabel extends OddkinElement.with({
  provenance: prop.object<Provenance>({
    description: 'Origin information supplied by the application.',
  }),
  strings: prop.object<Partial<typeof AI_LABEL_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal */
  get _strings(): typeof AI_LABEL_STRINGS {
    return strings(AI_LABEL_STRINGS, this.strings);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-ai-label': OddkinAiLabel;
  }
}
