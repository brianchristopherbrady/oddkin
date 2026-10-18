import { OddkinElement, prop } from '@oddkin/core/element';
import type { Suggestion } from '../contracts/types.js';
import { suggestionSelectEvent, suggestionSubmitEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export const SUGGESTIONS_STRINGS = {
  label: 'Suggested follow-ups',
  send: 'Send: {label}',
};

/**
 * Suggested prompts. Activating a suggestion inserts it for editing; the separate send button
 * submits it directly. The two intents are distinct events.
 *
 * @csspart list - The suggestions.
 * @csspart suggestion - Insert button.
 * @csspart send - Send button.
 * @a11y A labelled list of button pairs; the send button's name includes the suggestion text.
 * @keyboard Tab between buttons; Enter or Space activates.
 * @useFor Follow-up prompts and quick actions after a response.
 * @notFor Navigation menus.
 * @category AI
 */
export class OddkinSuggestions extends OddkinElement.with({
  suggestions: prop.array<Suggestion>({ description: 'Suggestions (replace to update).' }),
  disabled: prop.boolean({
    reflect: true,
    description: 'Disable both actions (e.g. while sending is unavailable).',
  }),
  insertOnly: prop.boolean({
    attribute: 'insert-only',
    description: 'Hide the direct send action.',
  }),
  strings: prop.object<Partial<typeof SUGGESTIONS_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = {
    'suggestion-select': suggestionSelectEvent,
    'suggestion-submit': suggestionSubmitEvent,
  };

  /** @internal */
  get _strings(): typeof SUGGESTIONS_STRINGS {
    return strings(SUGGESTIONS_STRINGS, this.strings);
  }

  #find(event: Event): Suggestion | undefined {
    const id = (event.currentTarget as HTMLElement).dataset['id'];
    return this.suggestions.find((s) => s.id === id);
  }
  /** @internal */
  readonly _select = (event: Event): void => {
    const s = this.#find(event);
    if (s && !this.disabled)
      this.emit(suggestionSelectEvent, { suggestionId: s.id, prompt: s.prompt });
  };
  /** @internal */
  readonly _submit = (event: Event): void => {
    const s = this.#find(event);
    if (s && !this.disabled)
      this.emit(suggestionSubmitEvent, { suggestionId: s.id, prompt: s.prompt });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-suggestions': OddkinSuggestions;
  }
}
