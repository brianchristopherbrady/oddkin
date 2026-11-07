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
 * supplied in an `odd-disclosure`. Shows information as supplied; it never asserts accuracy.
 *
 * @csspart base - The `odd-disclosure` around the label and its details.
 * @csspart label - The visible label: the disclosure's summary.
 * @csspart details - The origin details.
 * @a11y The label is the disclosure's native `<summary>`, named by the label text; the marker is hidden from assistive technology. Its details are read in document order when expanded.
 * @keyboard Enter or Space toggles the details.
 * @useFor Marking responses, artifacts, or edits as AI generated or assisted, with origin details.
 * @notFor Asserting factual accuracy or safety; use the host's own review states.
 * @limitation Labels and details are application-supplied; nothing is inferred from content.
 * @customization 1 2
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
