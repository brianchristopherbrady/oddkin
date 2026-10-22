/**
 * `<oddkin-workbench>`: the Workbench shell (workbench.md §2.1, workbench-pages.md §3). It loads the
 * index, runs an `@oddkin/app` application whose router is generated from the page registry, and
 * renders into the light DOM, because it owns the document's landmarks, skip link, and fragments.
 */
import { createApp, type AppService } from '@oddkin/app/app';
import { pageLifecycle } from '@oddkin/app/lifecycle';
import { createRouter, type Router, type RouterState } from '@oddkin/app/router';
import { OddkinElement, prop } from '@oddkin/core/element';
import { settled, signal, untracked } from '@oddkin/core/reactive';
import type { Scope } from '@oddkin/core/scope';
import { html, nothing } from '@oddkin/core/template';
import {
  DATA_VERSION,
  INDEX_FORMAT,
  PAGE_FORMAT,
  type ComponentPageData,
  type FoundationPageData,
  type ThemeStudioPageData,
  type WorkbenchIndex,
} from '../data/types.js';
import { href as registryHref } from '../pages/navigation.js';
import type { PageEntry } from '../pages/types.js';
import { COPY } from './copy.js';
import { shellRoutes, type ShellView } from './routes.js';
import { search, searchItems, type SearchItem } from './search.js';
import { shellStyles } from './styles.js';
import {
  appearanceControl,
  header,
  inline,
  messagePage,
  overviewBody,
  pageHeader,
  sectionsBody,
  sidebarView,
  toc,
  type Appearance,
  type ViewContext,
} from './views.js';

/** Where the shell reads its data; the default fetches the index and page files over HTTP. */
export interface WorkbenchSource {
  index(signal: AbortSignal): Promise<unknown>;
  page(file: string, signal: AbortSignal): Promise<unknown>;
  /** Optional frame document URL for injected sources; HTTP sources derive this from `index`. */
  readonly previewFrameUrl?: string;
}

/** What the dev server sends after each rebuild (`event: update`). */
interface Update {
  readonly ok: boolean;
  readonly index: boolean;
  readonly pages: readonly string[];
  /** `name@version` of packages whose files changed. */
  readonly modules?: readonly string[];
  readonly shell: boolean;
  readonly diagnostics: readonly { readonly severity: string }[];
}

const APPEARANCE_KEY = 'oddkin-workbench:appearance';
const SEARCH_LIMIT = 20;

function readAppearance(storage: Storage | undefined): Appearance {
  try {
    const value = storage?.getItem(APPEARANCE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

async function fetchJson(url: URL, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  return response.json() as Promise<unknown>;
}

const isIndex = (value: unknown): value is WorkbenchIndex =>
  typeof value === 'object' &&
  value !== null &&
  (value as WorkbenchIndex).format === INDEX_FORMAT &&
  (value as WorkbenchIndex).version === DATA_VERSION;

const isComponentPageData = (value: unknown): value is ComponentPageData => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const page = value as Partial<ComponentPageData>;
  return (
    page.format === PAGE_FORMAT &&
    page.version === DATA_VERSION &&
    page.kind === 'component' &&
    typeof page.tag === 'string' &&
    typeof page.package === 'string' &&
    typeof page.module === 'string' &&
    typeof page.declaration === 'object' &&
    page.declaration !== null &&
    Array.isArray(page.examples)
  );
};

const isThemeStudioPageData = (value: unknown): value is ThemeStudioPageData => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const page = value as Partial<ThemeStudioPageData>;
  return (
    page.format === PAGE_FORMAT &&
    page.version === DATA_VERSION &&
    page.kind === 'tool' &&
    typeof page.studio === 'object' &&
    page.studio !== null &&
    Array.isArray(page.studio.roles)
  );
};

const isFoundationPageData = (value: unknown): value is FoundationPageData => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const page = value as Partial<FoundationPageData>;
  return (
    page.format === PAGE_FORMAT &&
    page.version === DATA_VERSION &&
    page.kind === 'foundation' &&
    typeof page.foundation === 'object' &&
    page.foundation !== null &&
    Array.isArray(page.tokens)
  );
};

export class OddkinWorkbench extends OddkinElement.with({
  index: prop.string({ default: '', description: 'URL of the Workbench index (`index.json`).' }),
  events: prop.string({
    default: '',
    description: 'URL of the live-update event stream; set by the dev server.',
  }),
}) {
  static override shadowRootOptions = null;
  static override styles = shellStyles;

  /** Replaces HTTP loading, for embedding and tests. Read when the element connects. */
  source: WorkbenchSource | undefined;

  readonly #index = signal<WorkbenchIndex | undefined>(undefined);
  readonly #failure = signal<string | undefined>(undefined);
  readonly #router = signal<Router | undefined>(undefined);
  readonly #stale = signal<number | undefined>(undefined);
  readonly #expanded = signal(false);
  readonly #query = signal('');
  readonly #appearance = signal<Appearance>('system');
  #items: SearchItem[] = [];
  #previewFrameUrl = '';
  /** Theme Studio's module, imported on the first visit to its route. */
  #studio: Promise<unknown> | undefined;
  readonly #studioError = signal('');

  #loadStudio(): void {
    this.#studio ??= import('./theme-studio.js').catch((error: unknown) => {
      this.#studio = undefined;
      this.#studioError.value = error instanceof Error ? error.message : String(error);
    });
  }

  protected override connected(scope: Scope): void {
    const doc = this.ownerDocument;
    const win = doc.defaultView;
    this.#appearance.value = readAppearance(win?.localStorage);
    scope.effect(() => {
      doc.documentElement.dataset['oddMode'] = this.#appearance.value;
    });
    scope.listen(doc, 'keydown', (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.closest('input, textarea, select, [contenteditable]');
      if (event.key !== '/' || editing || event.ctrlKey || event.metaKey || event.altKey) return;
      const input = this.querySelector<HTMLInputElement>('.wb-search input');
      if (!input) return;
      event.preventDefault();
      input.focus();
    });
    const indexUrl = new URL(this.index || '_oddkin/index.json', doc.baseURI);
    this.#previewFrameUrl = this.source?.previewFrameUrl ?? new URL('frame.html', indexUrl).href;
    const source: WorkbenchSource = this.source ?? {
      index: (signal) => fetchJson(indexUrl, signal),
      page: (file, signal) => fetchJson(new URL(file, indexUrl), signal),
    };
    const events = this.events ? new URL(this.events, doc.baseURI) : undefined;
    // One application per connection. The page lifecycle service suspends it while the page is
    // in the back/forward cache, which closes the live-update stream (Firefox keeps a cached
    // page's connection open otherwise, and six of them exhaust its connections to the host).
    const app = createApp({
      name: 'oddkin-workbench',
      setup: ({ use, scope: root }) => {
        use(pageLifecycle(app));
        if (events) use(this.#updates(events, source, root));
        void this.#load(source, root);
      },
    });
    app.start();
    scope.add(() => app.stop());
  }

  #run: Scope | undefined;

  /** Load the index; (re)start the router when it is new or changed. */
  async #load(source: WorkbenchSource, root: Scope): Promise<void> {
    let value: unknown;
    try {
      value = await source.index(root.signal);
    } catch (error) {
      if (!root.signal.aborted)
        this.#failure.value = `${COPY.indexFailed}: ${error instanceof Error ? error.message : String(error)}`;
      return;
    }
    if (root.signal.aborted) return;
    if (!isIndex(value)) {
      const { format, version } = (value ?? {}) as { format?: unknown; version?: unknown };
      this.#failure.value = `${COPY.indexIncompatible} (${String(format)} ${String(version)}).`;
      return;
    }
    const current = this.#index.value;
    if (current && JSON.stringify(current) === JSON.stringify(value)) return;
    if (!current) performance.mark('oddkin-workbench:index');
    this.#run?.dispose();
    this.#failure.value = undefined;
    this.#index.value = value;
    this.#items = searchItems(value.registry);
    this.#start(value, source, root.child());
  }

  /** One router over the registry's routes, owned by `run`. */
  #start(index: WorkbenchIndex, source: WorkbenchSource, run: Scope): void {
    this.#run = run;
    const { registry } = index;
    const brand = index.branding.name;
    const router = run.use(
      createRouter({
        name: 'oddkin-workbench',
        base: registry.basePath,
        mode: registry.routing,
        routes: shellRoutes(registry, (page, { signal }) => {
          const file = index.pages[page.id];
          return file ? source.page(file, signal) : undefined;
        }),
        formatTitle: (title, state) =>
          state.status === 'not-found'
            ? `${COPY.notFound} · ${brand}`
            : title && title !== brand
              ? `${title} · ${brand}`
              : brand,
        focus: () => this.querySelector('main h1') ?? this.querySelector('main'),
      }),
    );
    this.#router.value = router;
    run.add(() => {
      if (this.#router.value === router) this.#router.value = undefined;
    });
    // Collapse the narrow sidebar after each navigation; mark the first rendered page once.
    let marked = false;
    let path: string | undefined;
    run.effect(() => {
      const state = router.state.value;
      if (state.status === 'idle') return;
      untracked(() => {
        if (state.location?.path !== path) this.#expanded.value = false;
        path = state.location?.path;
        if (!marked) {
          marked = true;
          void settled().then(() => performance.mark('oddkin-workbench:ready'));
        }
      });
    });
  }

  /**
   * The dev server's updates as an application service: the stream closes while the page is
   * suspended, and reopens on restoration with the index read again for missed changes.
   */
  #updates(url: URL, source: WorkbenchSource, root: Scope): AppService {
    let events: EventSource | undefined;
    const open = () => {
      events = new EventSource(url);
      events.addEventListener('update', (event) =>
        this.#onUpdate(JSON.parse((event as MessageEvent<string>).data) as Update, source, root),
      );
    };
    const close = () => {
      events?.close();
      events = undefined;
    };
    return {
      connect: (scope) => {
        open();
        scope.add(close);
      },
      suspend: close,
      resume: () => {
        open();
        void this.#load(source, root);
      },
    };
  }

  #onUpdate(update: Update, source: WorkbenchSource, root: Scope): void {
    if (update.shell) {
      this.ownerDocument.defaultView?.location.reload();
      return;
    }
    if (!update.ok) {
      this.#stale.value = update.diagnostics.filter((d) => d.severity === 'error').length;
      return;
    }
    this.#stale.value = undefined;
    // Changed component code needs a fresh realm: a registration cannot be redefined in place.
    if (update.modules?.length)
      void this.querySelector('oddkin-workbench-component')?.replacePreview();
    if (update.index) {
      void this.#load(source, root);
      return;
    }
    const view = this.#view(this.#router.value?.state.value);
    if (view?.kind === 'page' && update.pages.includes(view.page.id))
      void this.#router.value?.refresh();
  }

  #view(state: RouterState | undefined): ShellView | undefined {
    const leaf = state?.matches.at(-1);
    return leaf?.status === 'ready' ? (leaf.data as ShellView | undefined) : undefined;
  }

  #searchView(ctx: ViewContext) {
    const query = this.#query.value;
    const { results, total } = search(this.#items, query, SEARCH_LIMIT);
    const clear = () => (this.#query.value = '');
    return html`<form class="wb-search" role="search" @submit=${(e: Event) => e.preventDefault()}>
      <label class="wb-visually-hidden" for="wb-search-input">${COPY.search}</label>
      <input
        id="wb-search-input"
        type="search"
        autocomplete="off"
        placeholder=${COPY.searchPlaceholder}
        aria-describedby="wb-search-status"
        aria-controls="wb-search-results"
        .value=${query}
        @input=${(e: Event) => (this.#query.value = (e.target as HTMLInputElement).value)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Escape') clear();
        }}
      />
      <p id="wb-search-status" class="wb-visually-hidden" aria-live="polite">
        ${query.trim() ? COPY.searchResults(results.length, total) : ''}
      </p>
      <ul id="wb-search-results" class="wb-search-results" ?hidden=${!query.trim() || !total}>
        ${results.map(
          (item) =>
            html`<li>
              <a href=${ctx.href(item.route)} @click=${clear}
                >${item.title}${item.summary ? html`<small>${inline(item.summary)}</small>` : nothing}</a
              >
            </li>`,
        )}
      </ul>
    </form>`;
  }

  #pageView(ctx: ViewContext, state: RouterState | undefined, current: PageEntry | undefined) {
    if (!state || state.status === 'idle') return html`<p role="status">${COPY.loading}</p>`;
    const first = ctx.registry.pages.find((p) => p.id === ctx.registry.primaryNav[0]);
    if (state.status === 'not-found')
      return messagePage(ctx, COPY.notFound, COPY.notFoundText(state.location?.path ?? '/'), first);
    if (state.status === 'error') {
      const error = state.error;
      return messagePage(
        ctx,
        COPY.pageFailed,
        error instanceof Error ? error.message : String(error),
        first,
      );
    }
    const view = this.#view(state);
    if (view?.kind === 'notice')
      return messagePage(ctx, 'Products and modes', COPY.productsDisabled, first);
    if (!current) return nothing;
    const kind = current.kind;
    const data = view?.kind === 'page' ? view.data : undefined;
    const index = this.#index.value;
    const studio = kind === 'tool' && isThemeStudioPageData(data) ? data : undefined;
    if (studio) this.#loadStudio();
    const body =
      kind === 'overview'
        ? overviewBody(ctx, current)
        : kind === 'tool'
          ? studio
            ? html`<div class="wb-body">
                ${
                  this.#studioError.value
                    ? html`<p role="alert">
                        Theme Studio could not load: ${this.#studioError.value}
                      </p>`
                    : nothing
                }
                <oddkin-workbench-theme-studio
                  .page=${studio}
                  .frameUrl=${this.#previewFrameUrl}
                ></oddkin-workbench-theme-studio>
              </div>`
            : html`<div class="wb-body"><p class="wb-muted">${COPY.toolPending}</p></div>`
          : kind === 'component' && isComponentPageData(data) && index
            ? html`<div class="wb-body">
                <oddkin-workbench-component
                  .page=${data}
                  .index=${index}
                  .href=${ctx.href}
                  .frameUrl=${this.#previewFrameUrl}
                ></oddkin-workbench-component>
              </div>`
            : kind === 'foundation' && isFoundationPageData(data) && index
              ? html`<div class="wb-body">
                  <oddkin-workbench-foundation
                    .page=${data}
                    .index=${index}
                    .href=${ctx.href}
                  ></oddkin-workbench-foundation>
                </div>`
              : sectionsBody(current);
    const contents = toc(ctx, current);
    return html`<div class=${contents === nothing ? 'wb-page' : 'wb-page wb-has-toc'}>
      ${pageHeader(ctx, current)} ${contents} ${body}
    </div>`;
  }

  protected override render() {
    const failure = this.#failure.value;
    if (failure)
      return html`<main id="main" class="wb-main" tabindex="-1">
        <p role="alert">${failure}</p>
      </main>`;
    const index = this.#index.value;
    if (!index) return html`<p class="wb-loading" role="status">${COPY.loading}</p>`;
    const router = this.#router.value;
    const state = router?.state.value;
    const view = this.#view(state);
    const current = view?.kind === 'page' ? view.page : undefined;
    const ctx: ViewContext = {
      registry: index.registry,
      href: (to) => router?.href(to) ?? registryHref(index.registry, to),
      lang: this.ownerDocument.documentElement.lang || 'en',
      ...(current?.section === 'components' && current.kind === 'overview'
        ? {
            catalog: {
              query: new URLSearchParams(state?.location?.search).get('q') ?? '',
              category: new URLSearchParams(state?.location?.search).get('category') ?? '',
              update: (query: string, category: string) => {
                const params = new URLSearchParams(
                  this.#router.value?.state.value.location?.search,
                );
                if (query.trim()) params.set('q', query.trim());
                else params.delete('q');
                if (category) params.set('category', category);
                else params.delete('category');
                const suffix = params.toString();
                void this.#router.value?.navigate(`${current.route}${suffix ? `?${suffix}` : ''}`, {
                  replace: true,
                });
              },
            },
          }
        : {}),
    };
    const stale = this.#stale.value;
    const side = current
      ? sidebarView(ctx, current, this.#expanded.value, () => {
          this.#expanded.value = !this.#expanded.value;
        })
      : nothing;
    const tools = html`${this.#searchView(ctx)}
    ${appearanceControl(this.#appearance.value, (value) => {
      this.#appearance.value = value;
      try {
        this.ownerDocument.defaultView?.localStorage.setItem(APPEARANCE_KEY, value);
      } catch {
        // Storage may be unavailable (private mode, quota); the choice still applies now.
      }
    })}`;
    return html`<a
        class="wb-skip"
        href="#main"
        @click=${(event: Event) => {
          event.preventDefault();
          this.querySelector<HTMLElement>('main')?.focus();
        }}
        >${COPY.skip}</a
      >
      ${header(ctx, index.branding, current, tools)}
      ${stale === undefined ? nothing : html`<p class="wb-banner" role="status">${COPY.stale(stale)}</p>`}
      <div class=${side === nothing ? 'wb-layout wb-no-sidebar' : 'wb-layout'}>
        ${side}
        <main id="main" class="wb-main" tabindex="-1">${this.#pageView(ctx, state, current)}</main>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'oddkin-workbench': OddkinWorkbench;
  }
}
