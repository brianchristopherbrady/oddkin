/**
 * `<oddkin-catalog-panel>`: the components catalog (workbench-pages.md §6) as an embeddable
 * panel: search, category buttons, counts, and grouped cards from the page registry. Cards load
 * no component modules and mount no frames; a host that loads the library may supply live
 * previews (`preview`). Filter changes update the panel and dispatch `oddkin-catalog-filter` so
 * the host can mirror them in its URL.
 */
import { OddkinElement, prop } from '@oddkin/core/element';
import { html } from '@oddkin/core/template';
import type { WorkbenchIndex } from '../data/types.js';
import type { PageEntry } from '../pages/types.js';
import { overviewBody, type ViewContext } from '../app/views.js';
import type { StyleInput } from '@oddkin/core/styles';
import { catalogLayoutStyles, catalogStyles } from './catalog-styles.js';
import { contentStyles, panelHostStyles } from './styles.js';

export interface CatalogFilterDetail {
  readonly query: string;
  readonly category: string;
}

export class OddkinCatalogPanel extends OddkinElement.with({
  index: prop.object<WorkbenchIndex>({ description: 'The Workbench index.' }),
  href: prop.custom<(route: string) => string>({
    default: () => (route: string) => route,
    coerce: (value) =>
      typeof value === 'function'
        ? { ok: true, value: value as (route: string) => string }
        : { ok: false, reason: 'expected a function' },
    description: 'Maps a Workbench route to a URL.',
  }),
  query: prop.string({ default: '', attribute: false, description: 'Search text.' }),
  category: prop.string({
    default: '',
    attribute: false,
    description: "Category label to show; '' shows every category.",
  }),
  groups: prop.object<readonly string[]>({
    description: 'Categories to list (for example every one but AI); unset lists all.',
  }),
  preview: prop.custom<((page: PageEntry) => Node | undefined) | undefined>({
    default: () => undefined,
    coerce: (value) =>
      value === undefined || typeof value === 'function'
        ? { ok: true, value: value as ((page: PageEntry) => Node | undefined) | undefined }
        : { ok: false, reason: 'expected a function' },
    description:
      'Returns a live preview for a card. Only a host that loads the library supplies one; the same page should get the same node.',
  }),
}) {
  static override styles: StyleInput = [
    panelHostStyles,
    contentStyles,
    catalogLayoutStyles,
    catalogStyles,
  ];

  protected override render() {
    const index = this.index;
    const page = index?.registry.pages.find((p) => p.id === 'components');
    if (!index || !page) return html`<div class="wb-content"></div>`;
    const ctx: ViewContext = {
      registry: index.registry,
      href: (route) => this.href(route),
      lang: this.ownerDocument.documentElement.lang || 'en',
      catalog: {
        query: this.query,
        category: this.category,
        ...(this.groups ? { groups: this.groups } : {}),
        ...(this.preview ? { preview: this.preview } : {}),
        update: (query, category) => {
          this.query = query;
          this.category = category;
          this.dispatchEvent(
            new CustomEvent<CatalogFilterDetail>('oddkin-catalog-filter', {
              bubbles: true,
              composed: true,
              detail: { query, category },
            }),
          );
        },
      },
    };
    return html`<div class="wb-content">${overviewBody(ctx, page)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-catalog-panel': OddkinCatalogPanel;
  }
  interface HTMLElementEventMap {
    'oddkin-catalog-filter': CustomEvent<CatalogFilterDetail>;
  }
}
