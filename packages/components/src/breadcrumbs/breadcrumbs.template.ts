import { computed } from '@oddkin/core/reactive';
import { html, repeat } from '@oddkin/core/template';
import { chevronEndGlyph, moreGlyph } from '../styles/glyphs.js';
import type { BreadcrumbEntry, OddkinBreadcrumbs } from './breadcrumbs.js';

/**
 * Anatomy: `part="base"` `<nav>` around the `list` (`<ol>`) of `item`s, each a `link`, the
 * `current` page, or the `more` button, after a `separator` from the second item on. Entries are
 * keyed by position, kind, and content, so each one renders once.
 */
export const breadcrumbsTemplate = (breadcrumbs: OddkinBreadcrumbs) => {
  const label = breadcrumbs.label || breadcrumbs._strings.value.label;
  return html`<nav part="base" class="breadcrumbs" aria-label=${label}>
    <ol part="list" class="list">
      ${repeat(
        breadcrumbs._entries.value,
        (entry) => entry.key,
        (entry) =>
          html`<li part="item" class="item">
            ${
              entry.kind === 'more' || !entry.first
                ? html`<span part="separator" class="separator" aria-hidden="true"
                    >${chevronEndGlyph}</span
                  >`
                : ''
            }${control(breadcrumbs, entry)}
          </li>`,
      )}
    </ol>
  </nav>`;
};

const control = (breadcrumbs: OddkinBreadcrumbs, entry: BreadcrumbEntry) => {
  if (entry.kind === 'more')
    return html`<button
      part="more"
      class="more"
      type="button"
      aria-label=${computed(() => breadcrumbs._moreLabel(entry.count))}
      @click=${() => breadcrumbs._reveal()}
    >
      ${moreGlyph}
    </button>`;
  if (entry.kind === 'current')
    return html`<span part="current" class="current" aria-current="page"
      >${entry.record.label}</span
    >`;
  return html`<a part="link" class="link" href=${entry.record.href}>${entry.record.label}</a>`;
};
