import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import type { PartOf } from '../contracts/types.js';
import { citationOpenEvent } from '../events.js';
import { strings } from '../internal/strings.js';

export type SourceRecord = PartOf<'source'>;

export const CITATION_STRINGS = {
  source: 'Source {index}: {title}',
  unresolved: 'Unresolved source reference {id}',
  unavailable:
    'This source is not available. The response referenced it, but no source record was supplied.',
  open: 'Open source',
  show: 'Show in sources',
  untitled: 'Untitled source',
};

/** Internal: asks the nearest message to reveal a source after an uncancelled `citation-open`. */
export const revealSourceEvent = event<{ readonly sourceId: string }>('ai-reveal-source', {
  bubbles: true,
  composed: true,
  cancelable: true,
  intent: 'user',
  description: 'Default action of citation-open: the nearest message reveals the source.',
});

/**
 * An inline citation marker with an accessible preview of its source. A missing source record
 * renders as an unresolved reference; nothing is invented.
 *
 * @csspart trigger - The marker button.
 * @csspart preview - The source preview.
 * @a11y The marker is a button named after the source ("Source 2: Title"); `aria-expanded` reflects the preview. The preview is ordinary content after the button, so screen readers and touch users reach it without hover.
 * @keyboard Enter or Space toggles the preview; Escape closes it and returns focus to the marker.
 * @useFor Inline references from generated text to its sources.
 * @notFor Footnotes in authored documents; use links.
 * @category AI
 */
export class OddkinCitation extends OddkinElement.with({
  sourceId: prop.string({
    default: '',
    attribute: 'source-id',
    description: 'Citation key (`[^key]`).',
  }),
  index: prop.number({ default: 0, description: 'Display number; 0 shows the key.' }),
  source: prop.object<SourceRecord>({
    description: 'The source record; undefined renders an unresolved reference.',
  }),
  strings: prop.object<Partial<typeof CITATION_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override shadowRootOptions: ShadowRootInit = { mode: 'open' };
  static override events = {
    'citation-open': citationOpenEvent,
    'ai-reveal-source': revealSourceEvent,
  };
  declare readonly _events?: ElementEvents<typeof OddkinCitation>;

  /** @internal Local presentation state. */
  readonly _open = signal(false);

  /** @internal */
  get _strings(): typeof CITATION_STRINGS {
    return strings(CITATION_STRINGS, this.strings);
  }

  /** @internal */
  readonly _toggle = (): void => {
    this._open.value = !this._open.value;
  };

  /** @internal */
  readonly _show = (): void => {
    const resolved = !!this.source;
    if (this.emit(citationOpenEvent, { sourceId: this.sourceId, resolved }) && resolved)
      this.emit(revealSourceEvent, { sourceId: this.sourceId });
  };

  protected override connected(scope: Scope): void {
    scope.listen(this, 'keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this._open.value) {
        this._open.value = false;
        this.shadowRoot?.querySelector<HTMLElement>('[part="trigger"]')?.focus();
        event.stopPropagation();
      }
    });
    // Close when focus leaves the citation (keyboard and touch alike).
    scope.listen(this, 'focusout', (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && (this.contains(next) || this.shadowRoot?.contains(next))) return;
      if (next) this._open.value = false;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-citation': OddkinCitation;
  }
}
