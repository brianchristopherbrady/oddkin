import { computed, signal, type Readable } from '@oddkin/core/reactive';
import { html } from '@oddkin/core/template';

/**
 * Texts other elements give a control whose focus target sits in its shadow root, such as a
 * tooltip anchored to it: `aria-describedby` cannot reach across the shadow boundary, so the
 * control renders the texts itself (component-contracts.md §2.4). One text per source, in the
 * order the sources first described it.
 */
export class ExternalDescriptions {
  readonly #entries = signal<ReadonlyMap<object, string>>(new Map());

  /** The texts joined by spaces; empty when there are none. */
  readonly text: Readable<string> = computed(() => [...this.#entries.value.values()].join(' '));

  /** Sets the source's text; `null` or an empty string removes it. */
  set(source: object, text: string | null): void {
    const entries = new Map(this.#entries.value);
    if (text) entries.set(source, text);
    else if (!entries.delete(source)) return;
    this.#entries.value = entries;
  }
}

/** The hidden element the inner control's `aria-describedby` lists as `external-description`. */
export const externalDescriptionTemplate = (text: string) =>
  html`<span id="external-description" hidden>${text}</span>`;
