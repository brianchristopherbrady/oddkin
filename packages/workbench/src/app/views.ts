/**
 * Shell views (workbench-pages.md §3–§6): header, primary navigation, contextual sidebar, page
 * headers, overview cards, the section scaffold, and "On this page". Everything is projected
 * from the page registry, so navigation, cards, routes, and search cannot drift apart.
 */
import { html, nothing, repeat } from '@oddkin/core/template';
import { cards, onThisPage, primaryNavigation, sidebar } from '../pages/navigation.js';
import type { PageEntry, PageRegistry } from '../pages/types.js';
import { COPY } from './copy.js';

export interface ViewContext {
  readonly registry: PageRegistry;
  /** URL of an application path (`/components/odd-button#api`) in the configured routing mode. */
  readonly href: (to: string) => string;
  readonly lang: string;
  readonly catalog?: {
    readonly query: string;
    readonly category: string;
    readonly update: (query: string, category: string) => void;
    /** Groups (categories) to list; empty lists every group. */
    readonly groups?: readonly string[];
    /** A live preview for a card, supplied by a host that loads the library (the docs). */
    readonly preview?: (page: PageEntry) => Node | undefined;
  };
}

export type Appearance = 'system' | 'light' | 'dark';

const formatDate = (iso: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  } catch {
    return iso;
  }
};

/** Text with Markdown code spans (`name`) shown as code; everything stays text, never markup. */
export function inline(text: string) {
  const parts = text.split('`');
  // An unmatched backtick stays literal.
  if (parts.length % 2 === 0) parts[parts.length - 2] += `\`${parts.pop() as string}`;
  return parts.map((part, i) => (i % 2 ? html`<code>${part}</code>` : part));
}

/** `Updated <date> · tag, tag`: each part only when known. */
export function metaLine(page: PageEntry, lang: string) {
  const parts: unknown[] = [];
  if (page.updated)
    parts.push(
      html`${COPY.updated} <time datetime=${page.updated}>${formatDate(page.updated, lang)}</time>`,
    );
  if (page.tags?.length) parts.push(page.tags.join(', '));
  if (!parts.length) return nothing;
  return html`<p class="wb-meta">${parts.flatMap((part, i) => (i ? [' · ', part] : [part]))}</p>`;
}

/** The overview page of a section, if the registry has one. */
export const overviewOf = (registry: PageRegistry, section: string) =>
  registry.pages.find((p) => p.visible && p.section === section && p.kind === 'overview');

export function header(
  ctx: ViewContext,
  brand: { readonly name: string; readonly logo?: string },
  current: PageEntry | undefined,
  tools: unknown,
) {
  const primary = primaryNavigation(ctx.registry);
  const home = ctx.registry.pages.find((p) => p.id === 'home' && p.visible) ?? primary[0];
  const state = (entry: PageEntry) =>
    current?.id === entry.id ? 'page' : current?.section === entry.section ? 'true' : null;
  return html`<header class="wb-header odd-cluster">
    <a class="wb-brand odd-row" href=${ctx.href(home?.route ?? '/')}
      >${brand.logo ? html`<img src=${brand.logo} alt="" />` : nothing}<span>${brand.name}</span></a
    >
    <nav class="wb-primary" aria-label=${COPY.primaryNavigation}>
      <ul class="odd-cluster">
        ${repeat(
          primary,
          (entry) => entry.id,
          (entry) =>
            html`<li>
              <a href=${ctx.href(entry.route)} aria-current=${state(entry)}>${entry.title}</a>
            </li>`,
        )}
      </ul>
    </nav>
    <div class="wb-tools odd-cluster">${tools}</div>
  </header>`;
}

export function appearanceControl(value: Appearance, change: (value: Appearance) => void) {
  const options = Object.entries(COPY.appearances) as [Appearance, string][];
  return html`<label class="odd-row"
    >${COPY.appearance}
    <select
      class="wb-appearance"
      .value=${value}
      @change=${(event: Event) => change((event.target as HTMLSelectElement).value as Appearance)}
    >
      ${options.map(
        ([key, label]) => html`<option value=${key} ?selected=${key === value}>${label}</option>`,
      )}
    </select></label
  >`;
}

export function sidebarView(
  ctx: ViewContext,
  current: PageEntry,
  expanded: boolean,
  toggle: () => void,
) {
  const groups = sidebar(ctx.registry, current.section);
  if (!groups.length) return nothing;
  const title = overviewOf(ctx.registry, current.section)?.title ?? current.section;
  return html`<nav class=${expanded ? 'wb-sidebar wb-expanded' : 'wb-sidebar'} aria-label=${title}>
    <button
      type="button"
      class="wb-sidebar-toggle"
      aria-expanded=${expanded ? 'true' : 'false'}
      aria-controls="wb-sidebar-list"
      @click=${toggle}
    >
      ${expanded ? COPY.hideSection(title) : COPY.showSection(title)}
    </button>
    <div class="wb-sidebar-list" id="wb-sidebar-list">
      ${groups.map(({ group, pages }, i) => {
        const label = group ? `wb-sidebar-group-${i}` : undefined;
        return html`${group ? html`<p class="wb-group-label" id=${label}>${group}</p>` : nothing}
          <ul aria-labelledby=${label ?? null}>
            ${repeat(
              pages,
              (page) => page.id,
              (page) =>
                html`<li>
                  <a
                    href=${ctx.href(page.route)}
                    aria-current=${page.id === current.id ? 'page' : null}
                    >${page.title}</a
                  >
                </li>`,
            )}
          </ul>`;
      })}
    </div>
  </nav>`;
}

export function pageHeader(ctx: ViewContext, page: PageEntry) {
  const overview = page.kind === 'overview';
  const eyebrow = page.eyebrow ?? (overview ? COPY.overviewEyebrow : undefined);
  const summary = page.summary ?? COPY.summaries[page.id];
  const back =
    page.kind === 'component' || page.kind === 'foundation' || page.kind === 'products'
      ? overviewOf(ctx.registry, page.section)
      : undefined;
  return html`<header class="wb-page-header">
    ${eyebrow ? html`<p class="wb-eyebrow">${eyebrow}</p>` : nothing}
    <h1>${page.title}</h1>
    ${summary ? html`<p class="wb-summary">${inline(summary)}</p>` : nothing}
    ${
      back
        ? html`<a class="wb-back" href=${ctx.href(back.route)}>${COPY.allPages(back.title)}</a>`
        : nothing
    }
  </header>`;
}

function card(ctx: ViewContext, page: PageEntry, level: 2 | 3) {
  const tag = page.kind === 'component' ? page.id.replace(/^components\//, '') : undefined;
  const preview = ctx.catalog?.preview?.(page);
  return html`<li>
    <odd-card
      class=${preview ? 'wb-card wb-has-preview' : 'wb-card'}
      padding=${preview ? 'none' : null}
    >
      ${preview ? html`<div class="wb-card-preview" slot="header">${preview}</div>` : nothing}
      ${level === 2 ? html`<h2>${page.title}</h2>` : html`<h3>${page.title}</h3>`}
      ${page.summary ? html`<p>${inline(page.summary)}</p>` : nothing} ${metaLine(page, ctx.lang)}
      <div class="wb-card-footer" slot="footer">
        ${tag ? html`<p class="wb-card-tag"><code>${tag}</code></p>` : nothing}
        <a class="wb-card-action" href=${ctx.href(page.route)}
          >${COPY.viewPage(tag !== undefined)}<span class="wb-visually-hidden"
            >: ${page.title}</span
          ></a
        >
      </div>
    </odd-card>
  </li>`;
}

/** Overview body: the section's cards, grouped when the section has groups (components). */
export function overviewBody(ctx: ViewContext, page: PageEntry) {
  if (page.availability === 'unavailable')
    return html`<div class="wb-body">
      <p><strong>${page.id === 'foundations' ? COPY.noFoundations : COPY.noComponents}</strong></p>
      ${page.id === 'foundations' ? html`<p class="wb-muted">${COPY.noFoundationsHelp}</p>` : nothing}
    </div>`;
  const filters = page.section === 'components' ? ctx.catalog : undefined;
  const shown = filters?.groups?.length ? new Set(filters.groups) : undefined;
  const allEntries = cards(ctx.registry, page.section).filter(
    (entry) => !shown || shown.has(entry.group ?? ''),
  );
  const categories = [...new Set(allEntries.map((entry) => entry.group ?? ''))];
  const selectedCategory = filters && categories.includes(filters.category) ? filters.category : '';
  const entries = filters
    ? allEntries.filter((entry) => {
        const text =
          `${entry.title} ${entry.id} ${entry.summary ?? ''} ${(entry.tags ?? []).join(' ')}`.toLowerCase();
        return (
          (!filters.query.trim() || text.includes(filters.query.trim().toLowerCase())) &&
          (!selectedCategory || (entry.group ?? '') === selectedCategory)
        );
      })
    : allEntries;
  const groups = new Map<string, PageEntry[]>();
  for (const entry of entries)
    groups.set(entry.group ?? '', [...(groups.get(entry.group ?? '') ?? []), entry]);
  const controls =
    filters === undefined
      ? nothing
      : html`<form
          class="wb-catalog-filters odd-stack"
          role="search"
          @submit=${(event: Event) => event.preventDefault()}
        >
          <div class="wb-catalog-search odd-cluster">
            <label class="odd-stack"
              >${COPY.componentSearch}
              <input
                type="search"
                name="q"
                placeholder=${COPY.componentSearchPlaceholder}
                aria-describedby="wb-catalog-hint"
                .value=${filters.query}
                @input=${(event: Event) =>
                  filters.update((event.target as HTMLInputElement).value, filters.category)}
              />
              <small id="wb-catalog-hint">${COPY.componentSearchHint}</small>
            </label>
            <p class="wb-counts odd-cluster">
              <span class="wb-count">${COPY.componentCount(allEntries.length)}</span>
              <span class="wb-count">${COPY.categoryCount(categories.length)}</span>
            </p>
          </div>
          <div class="wb-categories odd-cluster" role="group" aria-label=${COPY.categoryFilter}>
            ${['', ...categories].map(
              (category) =>
                html`<button
                  type="button"
                  aria-pressed=${category === selectedCategory ? 'true' : 'false'}
                  @click=${() => filters.update(filters.query, category)}
                >
                  ${category || COPY.allCategories}
                </button>`,
            )}
          </div>
          <p class="wb-muted" aria-live="polite">
            ${COPY.componentResults(entries.length, allEntries.length)}
          </p>
        </form>`;
  if (!entries.length)
    return html`<div class="wb-body">
      ${controls}
      <p role="status">${COPY.noComponentResults}</p>
    </div>`;
  if (groups.size === 1 && groups.has(''))
    return html`<div class="wb-body">
      ${controls}
      <ul class="wb-cards odd-grid">
        ${repeat(
          entries,
          (entry) => entry.id,
          (entry) => card(ctx, entry, 2),
        )}
      </ul>
    </div>`;
  return html`<div class="wb-body">
    ${controls}
    ${[...groups].map(
      ([group, pages], i) =>
        html`<section class="wb-group" aria-labelledby=${`wb-group-${i}`}>
          <h2 id=${`wb-group-${i}`}>${group} <span class="wb-muted">(${pages.length})</span></h2>
          <ul class="wb-cards odd-grid">
            ${repeat(
              pages,
              (entry) => entry.id,
              (entry) => card(ctx, entry, 3),
            )}
          </ul>
        </section>`,
    )}
  </div>`;
}

/** Detail pages without generated content: a section per visible registry section. */
export function sectionsBody(page: PageEntry) {
  return html`<div class="wb-body">
    ${repeat(
      page.sections.filter((s) => s.visible),
      (section) => section.id,
      (section) =>
        html`<section id=${section.id} aria-labelledby=${`${section.id}-title`}>
          <h2 id=${`${section.id}-title`}>${section.title}</h2>
          <p class="wb-muted">${COPY.sectionPending}</p>
        </section>`,
    )}
  </div>`;
}

export function toc(ctx: ViewContext, page: PageEntry) {
  const entries = onThisPage(page);
  if (!entries.length) return nothing;
  return html`<nav class="wb-toc" aria-labelledby="wb-toc-title">
    <h2 id="wb-toc-title">${COPY.onThisPage}</h2>
    <ul>
      ${repeat(
        entries,
        (entry) => entry.id,
        (entry) =>
          html`<li><a href=${ctx.href(`${page.route}#${entry.id}`)}>${entry.title}</a></li>`,
      )}
    </ul>
  </nav>`;
}

/** A page with a heading and one paragraph: not found, a failed page, a notice. */
export function messagePage(ctx: ViewContext, title: string, text: string, link?: PageEntry) {
  return html`<div class="wb-page">
    <header class="wb-page-header">
      <h1>${title}</h1>
      <p class="wb-summary">${text}</p>
      ${link ? html`<a class="wb-back" href=${ctx.href(link.route)}>${link.title}</a>` : nothing}
    </header>
  </div>`;
}
