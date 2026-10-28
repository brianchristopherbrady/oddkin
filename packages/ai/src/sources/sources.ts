import { OddkinElement, prop } from '@oddkin/core/element';
import { signal } from '@oddkin/core/reactive';
import type { SourceRecord } from '../citation/citation.js';
import { strings } from '../internal/strings.js';

export const SOURCES_STRINGS = {
  heading: 'Sources',
  count: '{count} sources',
  open: 'Open',
  untitled: 'Untitled source',
};

/**
 * The list of sources behind a response. Each entry is a navigation target for citations.
 *
 * @csspart base - The region labelled by the heading, around the list.
 * @csspart list - The ordered list of sources.
 * @csspart item - One source.
 * @a11y A labelled list; entries are numbered in citation order. `reveal()` scrolls to and focuses an entry (only on user request).
 * @useFor Showing the sources a response used, with titles, hosts, and excerpts.
 * @notFor Arbitrary link lists; use a list of links.
 * @category AI
 */
export class OddkinSources extends OddkinElement.with({
  sources: prop.array<SourceRecord>({
    description: 'Source records in citation order (replaced, never mutated).',
  }),
  label: prop.string({
    default: '',
    description:
      'Visible heading and accessible name of the list; defaults to the localized "Sources".',
  }),
  strings: prop.object<Partial<typeof SOURCES_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  /** @internal The entry most recently revealed (highlighted). */
  readonly _revealed = signal<string | undefined>(undefined);

  /** @internal */
  get _strings(): typeof SOURCES_STRINGS {
    return strings(SOURCES_STRINGS, this.strings);
  }

  /** Scroll to and focus the entry for `sourceId`. Returns false when it is not listed. */
  reveal(sourceId: string): boolean {
    const item = this.shadowRoot?.querySelector<HTMLElement>(
      `[data-source-id="${CSS.escape(sourceId)}"]`,
    );
    if (!item) return false;
    this._revealed.value = sourceId;
    item.scrollIntoView({ block: 'nearest' });
    item.focus();
    return true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-sources': OddkinSources;
  }
}
