import { OddkinElement, event, prop, type ElementEvents } from '@oddkin/core/element';
import { format, strings } from '@oddkin/core/i18n';
import { computed, type Readable } from '@oddkin/core/reactive';
import type { NavigationActionDetail } from '../side-nav/side-nav.js';

export const PAGINATION_STRINGS = {
  label: 'Pagination',
  previous: 'Previous page',
  next: 'Next page',
  page: 'Page {page}',
  status: 'Page {current} of {count}',
};

/** The side-nav action intent: `id` is the page number, `action` is `"page"`. */
export const paginationActionEvent = event<NavigationActionDetail>('odd-action', {
  bubbles: true,
  composed: true,
  cancelable: false,
  intent: 'user',
  description:
    'A page button was activated (without `href`): `detail.id` is the page number and `detail.action` is "page". The application sets `current`.',
});

/** One entry of the page list. */
export type PaginationEntry =
  | { readonly kind: 'previous' | 'next'; readonly key: string }
  | { readonly kind: 'page'; readonly key: string; readonly page: number }
  | { readonly kind: 'gap'; readonly key: string };

/**
 * Page navigation: the position as text, previous and next, and the first, last, and nearby pages
 * with ellipses between. With `href`, pages are links; without it, buttons that report
 * `odd-action` so the application can load the page.
 *
 * @csspart base - The `<nav>` surface.
 * @csspart status - The position text ("Page 3 of 12").
 * @csspart list - The list of controls.
 * @csspart previous - The previous-page link or button.
 * @csspart next - The next-page link or button.
 * @csspart page - Each page link or button; the current one has `aria-current="page"`.
 * @csspart ellipsis - The mark between distant pages.
 * @cssprop --odd-pagination-radius - Corner radius of the surface.
 * @a11y A `<nav>` landmark named by `label` (default `strings.label`). Pages are named "Page 3" (`strings.page`) and the current one has `aria-current="page"`. At the ends, previous or next is disabled (a disabled button, or a link without `href` with `aria-disabled`). Ellipses are hidden from assistive technology.
 * @keyboard Tab moves through previous, the pages, and next; Enter (and Space on buttons) activates.
 * @previewRole pagination
 * @useFor Moving through a long list or result set one page at a time.
 * @notFor Steps of a process; switching views (use odd-tabs); short lists (show everything).
 * @category Navigation
 */
export class OddkinPagination extends OddkinElement.with({
  label: prop.string({
    default: '',
    description: 'Names the navigation; default `strings.label`.',
  }),
  current: prop.string({ default: '1', description: 'The current page number.' }),
  pageCount: prop.number({ default: 1, description: 'The number of pages (at least 1).' }),
  href: prop.string({
    default: '',
    description: 'A link template with `{page}`, as in "?page={page}"; when set, pages are links.',
  }),
  strings: prop.object<Partial<typeof PAGINATION_STRINGS>>({
    description: 'Localized string overrides.',
  }),
}) {
  static override events = { 'odd-action': paginationActionEvent };
  declare readonly _events?: ElementEvents<typeof OddkinPagination>;

  /** @internal The number of pages, at least 1. */
  readonly _count: Readable<number> = computed(() => Math.max(1, Math.floor(this.pageCount) || 1));
  /** @internal The current page, within 1 and the page count. */
  readonly _page: Readable<number> = computed(() =>
    Math.min(this._count.value, Math.max(1, Math.floor(Number(this.current)) || 1)),
  );
  /** @internal The built-in text with the author's overrides. */
  readonly _strings: Readable<typeof PAGINATION_STRINGS> = computed(() =>
    strings(PAGINATION_STRINGS, this.strings),
  );

  /**
   * @internal Previous, the pages shown, gaps, and next. Shown: the first and last page, the
   * current one and its neighbours, the first or last three near either end; a gap of one page
   * shows that page instead.
   */
  readonly _entries: Readable<readonly PaginationEntry[]> = computed(() => {
    const count = this._count.value;
    const page = this._page.value;
    const shown = new Set([1, count, page - 1, page, page + 1]);
    if (page <= 2) [1, 2, 3].forEach((p) => shown.add(p));
    if (page >= count - 1) [count - 2, count - 1, count].forEach((p) => shown.add(p));
    const pages = [...shown].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
    const mode = this.href ? 'link' : 'button';
    const entries: PaginationEntry[] = [{ kind: 'previous', key: `${mode}:previous` }];
    pages.forEach((p, i) => {
      const before = pages[i - 1];
      if (before !== undefined && p - before === 2)
        entries.push({ kind: 'page', key: `${mode}:${p - 1}`, page: p - 1 });
      else if (before !== undefined && p - before > 2)
        entries.push({ kind: 'gap', key: `${mode}:gap:${p}` });
      entries.push({ kind: 'page', key: `${mode}:${p}`, page: p });
    });
    entries.push({ kind: 'next', key: `${mode}:next` });
    return entries;
  });

  /** @internal The position as text (`strings.status`). */
  readonly _status: Readable<string> = computed(() =>
    format(this._strings.value.status, {
      current: String(this._page.value),
      count: String(this._count.value),
    }),
  );

  /** @internal The link to a page, from the `href` template. */
  _hrefFor(page: number): string {
    return this.href.replaceAll('{page}', String(page));
  }

  /** @internal A page button was activated. */
  _go(page: number): void {
    this.emit(paginationActionEvent, { id: String(page), action: 'page' });
  }

  /** @internal The name of a page control. */
  _pageLabel(page: number): string {
    return format(this._strings.value.page, { page: String(page) });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'odd-pagination': OddkinPagination;
  }
}
