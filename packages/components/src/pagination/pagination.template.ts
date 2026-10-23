import { computed } from '@oddkin/core/reactive';
import { html, repeat } from '@oddkin/core/template';
import { arrowEndGlyph, arrowStartGlyph, moreGlyph } from '../styles/glyphs.js';
import type { OddkinPagination, PaginationEntry } from './pagination.js';

/**
 * Anatomy: `part="base"` `<nav>` with the `status` text and the `list` of `previous`, `page`, and
 * `next` links or buttons with `ellipsis` marks. Entries are keyed by page and mode, and bind the
 * current page as readables, so a focused page keeps its node when the page changes.
 */
export const paginationTemplate = (pagination: OddkinPagination) => {
  const label = pagination.label || pagination._strings.value.label;
  return html`<nav part="base" class="pagination" aria-label=${label}>
    <p part="status" class="status">${pagination._status.value}</p>
    <ul part="list" class="list">
      ${repeat(
        pagination._entries.value,
        (entry) => entry.key,
        (entry) => html`<li class="item">${control(pagination, entry)}</li>`,
      )}
    </ul>
  </nav>`;
};

const control = (pagination: OddkinPagination, entry: PaginationEntry) => {
  const link = !!pagination.href;
  if (entry.kind === 'gap')
    return html`<span part="ellipsis" class="ellipsis" aria-hidden="true">${moreGlyph}</span>`;
  if (entry.kind === 'page') {
    const page = entry.page;
    const current = computed(() => (pagination._page.value === page ? 'page' : null));
    const name = computed(() => pagination._pageLabel(page));
    return link
      ? html`<a
          part="page"
          class="tile page"
          href=${computed(() => pagination._hrefFor(page))}
          aria-current=${current}
          aria-label=${name}
          >${page}</a
        >`
      : html`<button
          part="page"
          class="tile page"
          type="button"
          aria-current=${current}
          aria-label=${name}
          @click=${() => pagination._go(page)}
        >
          ${page}
        </button>`;
  }
  const previous = entry.kind === 'previous';
  const target = computed(() =>
    previous ? pagination._page.value - 1 : pagination._page.value + 1,
  );
  const disabled = computed(() => target.value < 1 || target.value > pagination._count.value);
  const name = computed(() =>
    previous ? pagination._strings.value.previous : pagination._strings.value.next,
  );
  const glyph = previous ? arrowStartGlyph : arrowEndGlyph;
  return link
    ? html`<a
        part=${entry.kind}
        class="tile step"
        href=${computed(() => (disabled.value ? null : pagination._hrefFor(target.value)))}
        role=${computed(() => (disabled.value ? 'link' : null))}
        aria-disabled=${computed(() => (disabled.value ? 'true' : null))}
        aria-label=${name}
        >${glyph}</a
      >`
    : html`<button
        part=${entry.kind}
        class="tile step"
        type="button"
        ?disabled=${disabled}
        aria-label=${name}
        @click=${() => pagination._go(target.value)}
      >
        ${glyph}
      </button>`;
};
