import { createApp } from '@oddkin/app/app';
import { createRouter, route, type AnyRoute, type RouterState } from '@oddkin/app/router';
import type {
  ComponentPageData,
  LibraryInput,
  TokenInspectionLike,
  WorkbenchData,
  WorkbenchIndex,
} from '@oddkin/workbench/data';
import { pages, type Page } from './pages/index.js';
import { icons } from './pages/icons.js';
import { repository } from './pages/model.js';
import { AI_DESCRIPTION, renderAi, type AiData } from './ai.js';
import {
  catalogGroups,
  catalogPreviews,
  componentTabs,
  examplePreviews,
  FRAME_URL,
  loadComponent,
  loadIndex,
  sourcePath,
} from './reference.js';
import { showRoute, startShell } from './shell.js';

type JsonRecord = Record<string, unknown>;

interface DocsData {
  readonly metadata: JsonRecord;
  readonly customElements: JsonRecord;
  readonly inspection: JsonRecord;
  /** Workbench index and page data built from the same published files, for the panels. */
  readonly workbench: WorkbenchData;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): JsonRecord {
  if (!isRecord(value)) throw new Error('Published docs data is not an object.');
  return value;
}

function entries(value: unknown): [string, unknown][] {
  return isRecord(value) ? Object.entries(value) : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** The `key` text of each record in a metadata list (`useFor` values, `tokenReads` tokens). */
function fields(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const field = isRecord(item) ? item[key] : undefined;
    return typeof field === 'string' ? [field] : [];
  });
}

function node<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string,
  value?: string,
): HTMLElementTagNameMap[K];
function node(name: string, className?: string, value?: string): HTMLElement;
function node(name: string, className?: string, value?: string): HTMLElement {
  const result = document.createElement(name);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = value;
  return result;
}

function appendText(parent: Element, name: keyof HTMLElementTagNameMap, value: unknown): void {
  if (typeof value === 'string' && value) parent.append(node(name, undefined, value));
}

async function publishedJson(path: string, signal: AbortSignal): Promise<JsonRecord> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}.`);
  return record(await response.json());
}

async function loadDocsData(signal: AbortSignal): Promise<DocsData> {
  // The page-data builder loads with the published files, so it never delays the app's start.
  const [metadata, customElements, inspection, { buildWorkbenchData }] = await Promise.all([
    publishedJson('/public/@oddkin/components/oddkin.metadata.json', signal),
    publishedJson('/public/@oddkin/components/custom-elements.json', signal),
    publishedJson('/public/@oddkin/tokens/inspect/default.json', signal),
    import('@oddkin/workbench/data'),
  ]);
  if (!isRecord(metadata['components']) || !isRecord(metadata['foundations']))
    throw new Error('Published Oddkin metadata is missing its components or foundations index.');
  if (!Array.isArray(inspection['tokens']))
    throw new Error('Published token inspection data has no token list.');
  const library = record(metadata['library']);
  const { data: workbench, diagnostics } = buildWorkbenchData({
    config: { library: { packages: ['@oddkin/components'] } },
    libraries: [
      {
        name: text(library['name'], '@oddkin/components'),
        version: text(library['version'], '0.0.0'),
        cem: customElements as unknown as NonNullable<LibraryInput['cem']>,
        metadata: metadata as unknown as NonNullable<LibraryInput['metadata']>,
      },
    ],
    tokens: inspection as unknown as TokenInspectionLike,
  });
  if (!workbench)
    throw new Error(
      `Reference pages could not be built: ${diagnostics.map((d) => d.message).join(' ')}`,
    );
  return { metadata, customElements, inspection, workbench };
}

function declarations(data: DocsData): JsonRecord[] {
  const modules = Array.isArray(data.customElements['modules'])
    ? data.customElements['modules']
    : [];
  return modules.flatMap((module) => {
    if (!isRecord(module) || !Array.isArray(module['declarations'])) return [];
    return module['declarations'].filter(isRecord);
  });
}

function componentDeclaration(data: DocsData, tag: string): JsonRecord | undefined {
  return declarations(data).find((declaration) => declaration['tagName'] === tag);
}

function displayError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Each page loads only the Workbench panel it renders; the router awaits it before committing.
const componentPanelModule = () => import('@oddkin/workbench/panels/component/define');
const layoutGuideRoute = route({
  path: 'layout/side-nav',
  title: 'Side navigation layout guide',
  load: componentPanelModule,
});
const componentsRoute = route({
  path: 'components',
  load: async ({ signal }: { signal: AbortSignal }) => {
    const [index] = await Promise.all([
      loadIndex(signal),
      import('@oddkin/workbench/panels/catalog/define'),
    ]);
    return index;
  },
  search: (params): CatalogFilter => ({
    query: params.get('q')?.trim() ?? '',
    category: params.get('category')?.trim() ?? '',
  }),
  title: 'Components',
});
const componentRoute = route({
  path: 'components/:tag',
  load: async ({ params, signal }: { params: { tag: string }; signal: AbortSignal }) => {
    const [index] = await Promise.all([loadIndex(signal), componentPanelModule()]);
    const page = await loadComponent(index, params.tag, signal);
    return { index, page };
  },
  params: ({ tag }) => (tag && /^[a-z0-9-]+$/.test(tag) ? { tag } : undefined),
  title: ({ params }) => `<${params.tag}>`,
});
const aiRoute = route({
  path: 'ai',
  load: async ({ signal }: { signal: AbortSignal }): Promise<AiData> => {
    const index = await loadIndex(signal);
    const [conversation, composer] = await Promise.all([
      loadComponent(index, 'odd-conversation', signal),
      loadComponent(index, 'odd-prompt-input', signal),
    ]);
    return { index, conversation, composer };
  },
  title: 'AI interfaces',
});
const caseStudyRoute = route({
  path: 'architecture/scope-ownership',
  title: 'Case study: scope ownership',
});
const searchRoute = route({
  path: 'search',
  search: (params) => params.get('q')?.trim() ?? '',
  title: 'Search',
});
const notFoundRoute = route({ path: '*', title: 'Not found' });

const docsRoute = route({
  path: '',
  title: 'Oddkin docs',
  load: ({ signal }) => loadDocsData(signal),
  children: [
    layoutGuideRoute,
    componentsRoute,
    componentRoute,
    aiRoute,
    caseStudyRoute,
    searchRoute,
    notFoundRoute,
  ],
});

// Authored pages arrive as HTML from the server, readable before this script runs; they need no data.
const pageRoutes = new Map(
  pages.map((page) => [
    route({ path: page.path, ...(page.path ? { title: page.title } : {}) }) as AnyRoute,
    page,
  ]),
);

const router = createRouter({
  routes: [...pageRoutes.keys(), docsRoute as AnyRoute],
  focus: () => document.querySelector('#main h1'),
  formatTitle: (title) => (title ? `${title} · Oddkin` : 'Oddkin'),
});

function makeLink(label: string, path: string): HTMLAnchorElement {
  const link = node('a', undefined, label);
  link.href = router.href(path);
  return link;
}

function pageHeader(eyebrow: string, title: string, summary?: string): HTMLElement {
  const header = node('header', 'page-header');
  header.append(node('p', 'eyebrow', eyebrow));
  header.append(node('h1', undefined, title));
  if (summary) header.append(node('p', 'lede', summary));
  return header;
}

function section(title: string, description?: string): HTMLElement {
  const result = node('section', 'content-section');
  result.append(node('h2', undefined, title));
  if (description) result.append(node('p', undefined, description));
  return result;
}

interface CatalogFilter {
  readonly query: string;
  readonly category: string;
}

/** Maps a Workbench route (`/components/odd-button`, `/foundations/color#tokens`) to a docs URL. */
const panelHref = (path: string): string => router.href(path);

/** The arrow of `pages/icons.ts`, made without parsing markup (the page's Trusted Types policy). */
function arrowIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const attributes = {
    class: 'icon',
    'aria-hidden': 'true',
    focusable: 'false',
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', / d="([^"]+)"/.exec(icons.arrowRight)?.[1] ?? '');
  svg.append(path);
  return svg;
}

/** A reference page's status, package, and source file (Figma "Component metadata", 20:2200). */
function componentMeta(page: ComponentPageData): HTMLElement {
  const row = node('div', 'component-meta odd-cluster');
  const status = node('odd-badge', undefined, 'In repository');
  status.setAttribute('tone', 'success');
  const source = node('a', 'odd-link', 'View source');
  source.href = `${repository}${sourcePath(page)}`;
  source.append(arrowIcon());
  row.append(status, node('code', undefined, page.package), source);
  return row;
}

let examplePreview: ReturnType<typeof examplePreviews> | undefined;
let catalogPreview: ReturnType<typeof catalogPreviews> | undefined;

function componentPanel(
  index: WorkbenchIndex,
  page: ComponentPageData,
  frameUrl = FRAME_URL,
): HTMLElement {
  const panel = document.createElement('oddkin-component-panel');
  panel.index = index;
  panel.page = page;
  panel.href = panelHref;
  panel.frameUrl = frameUrl;
  return panel;
}

/** A component reference page's panel: the documentation layout of Figma 20:2190. */
function referencePanel(
  index: WorkbenchIndex,
  page: ComponentPageData,
): HTMLElementTagNameMap['oddkin-component-panel'] {
  const panel = componentPanel(index, page) as HTMLElementTagNameMap['oddkin-component-panel'];
  panel.layout = 'reference';
  panel.examplePreview = examplePreview ??= examplePreviews();
  return panel;
}

function catalogUrl({ query, category }: CatalogFilter): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  const search = params.toString();
  return search ? `/components?${search}` : '/components';
}

function renderComponents(main: HTMLElement, index: WorkbenchIndex, filter: CatalogFilter): void {
  main.append(
    pageHeader(
      'Reference',
      'Component catalog',
      'Every published component, with a live example. Each reference page has the full API, an interactive example, and the generated code.',
    ),
  );
  const panel = document.createElement('oddkin-catalog-panel');
  panel.index = index;
  panel.href = panelHref;
  panel.groups = catalogGroups(index);
  panel.preview = catalogPreview ??= catalogPreviews(index);
  panel.query = filter.query;
  panel.category = filter.category;
  // The panel updates itself; the URL follows without a new history entry or a re-render.
  panel.addEventListener('oddkin-catalog-filter', (event) => {
    void router.navigate(catalogUrl(event.detail), { replace: true });
  });
  // The AI elements have their own page (Figma 20:1926, under a divider).
  const next = node('div', 'page-next');
  const ai = makeLink('Explore AI interaction components', '/ai');
  ai.className = 'odd-link';
  ai.append(arrowIcon());
  next.append(ai);
  main.append(panel, next);
}
function renderLayoutGuide(main: HTMLElement, data: DocsData): void {
  const recipe = record(record(data.metadata['recipes'])['recipe:side-nav']);
  main.append(
    pageHeader(
      'Layout guide',
      'Side navigation',
      'A container-responsive navigation pattern documented from the published recipe and component contracts.',
    ),
  );

  const recipeSection = section('Recipe and regions');
  const regions = record(recipe['regions']);
  recipeSection.append(
    node(
      'p',
      undefined,
      `The ${text(recipe['name'])} recipe names the ${Object.keys(regions).join(', ')} regions. Its base, variant, and condition layers keep layout rules ordered.`,
    ),
  );
  const conditions = strings(recipe['conditions']);
  recipeSection.append(
    node(
      'p',
      undefined,
      `Responsive condition: ${conditions.join('; ') || 'No condition published.'}`,
    ),
  );
  recipeSection.append(
    node(
      'p',
      undefined,
      'The recipe uses the side-nav host as a size container. At 40rem inline size, top-level links arrange in three columns; the behavior follows the container, not the viewport.',
    ),
  );
  main.append(recipeSection);

  const sources = section('Choose a content source');
  sources.append(node('h3', undefined, 'Data-driven'));
  sources.append(
    node(
      'p',
      undefined,
      'Assign a new items array for structured links, actions, and expandable groups. Reassign rather than mutate the array.',
    ),
  );
  const dataCode = node('pre');
  dataCode.textContent =
    'nav.items = [\n  { kind: "link", id: "overview", label: "Overview", href: "/overview" },\n  {\n    kind: "group",\n    id: "guides",\n    label: "Guides",\n    items: [{ kind: "link", id: "recipes", label: "Recipes", href: "/guides/recipes" }],\n  },\n];';
  sources.append(dataCode);
  sources.append(node('h3', undefined, 'Declarative'));
  sources.append(
    node(
      'p',
      undefined,
      'Leave items unset and provide native links or lists in the default slot. Native anchors retain browser behaviors such as modified clicks and context menus.',
    ),
  );
  const declarativeCode = node('pre');
  declarativeCode.textContent =
    '<odd-side-nav label="Sections">\n  <a href="/overview">Overview</a>\n  <a href="/guides">Guides</a>\n</odd-side-nav>';
  sources.append(declarativeCode);
  sources.append(node('h3', undefined, 'Hybrid composition'));
  sources.append(
    node(
      'p',
      undefined,
      'Use the items property as the sole source for entries while filling the named header and footer slots with surrounding content. The sources are not merged: even an empty items array suppresses default-slot entries.',
    ),
  );
  sources.append(node('p', undefined, 'HTML'));
  const hybridHtml = node('pre');
  hybridHtml.textContent =
    '<odd-side-nav id="sections" label="Sections">\n  <strong slot="header">Product</strong>\n  <a slot="footer" href="/help">Help</a>\n</odd-side-nav>';
  sources.append(hybridHtml, node('p', undefined, 'JavaScript'));
  const hybridJs = node('pre');
  hybridJs.textContent =
    "import '@oddkin/components/define/side-nav';\n\nconst nav = document.querySelector('#sections');\nif (!nav) throw new Error('Side navigation element not found.');\nnav.items = [\n  { kind: 'link', id: 'overview', label: 'Overview', href: '/overview' },\n];";
  sources.append(hybridJs);
  main.append(sources);

  const roles = section('Profile and conditions');
  const scopes = Array.isArray(data.inspection['scopes'])
    ? data.inspection['scopes'].filter(isRecord)
    : [];
  const profile = scopes.find((scope) => text(scope['selector']).includes('navigation.compact'));
  const profileTokens = strings(profile?.['changed']);
  roles.append(
    node(
      'p',
      undefined,
      profile
        ? `The published navigation.compact profile changes ${profileTokens.join(', ')}. Apply it with data-odd-profile="navigation.compact" on a scope that contains the navigation.`
        : 'The published token inspection does not include a navigation.compact profile.',
    ),
  );
  roles.append(
    node(
      'p',
      undefined,
      'Recipe conditions can re-declare a profile on the region inside its container query. The side-nav recipe changes arrangement at its own 40rem inline-size threshold; it does not need a JavaScript resize observer.',
    ),
  );
  roles.append(makeLink('Browse the side-nav component reference', '/components/odd-side-nav'));
  main.append(roles);

  const page = data.workbench.pages['components/odd-side-nav'];
  if (page?.kind === 'component')
    main.append(componentPanel(data.workbench.index, page as ComponentPageData, ''));
}

/** The Foundations page that documents a token, by its name. */
function foundationOf(name: string): string {
  const [head = '', second = ''] = name.split('.');
  if (head === 'color' || head === 'ref') return 'color';
  if (['type', 'font', 'line-height', 'letter-spacing'].includes(head)) return 'typography';
  if (head === 'space') return 'spacing';
  if (['border', 'radius', 'focus'].includes(head) || second === 'radius')
    return 'borders-and-radii';
  if (head === 'elevation' || head === 'motion') return head;
  if (head === 'layout') return 'responsive';
  return 'tokens';
}

function renderSearch(main: HTMLElement, query: string, data: DocsData): void {
  main.append(
    pageHeader(
      'Local search',
      'Search Oddkin docs',
      'Search this page index locally; no remote service or component module is loaded.',
    ),
  );
  const form = node('form', 'search-form odd-row');
  const label = node('label', undefined, 'Search guides, foundations, components, and tokens');
  label.htmlFor = 'docs-search';
  const input = node('input');
  input.id = 'docs-search';
  input.name = 'q';
  input.type = 'search';
  input.value = query;
  form.append(label, input);
  const submit = node('button', undefined, 'Search');
  submit.type = 'submit';
  form.append(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void router.navigate(`/search?q=${encodeURIComponent(input.value.trim())}`);
  });
  main.append(form);

  const searchItems: { title: string; path: string; body: string }[] = [
    ...pages.map((page: Page) => ({
      title: page.title,
      path: `/${page.path}`,
      body: `${page.summary} ${page.sections.map((s) => s.title).join(' ')}`,
    })),
    {
      title: 'Side navigation layout guide',
      path: '/layout/side-nav',
      body: 'layout recipe regions conditions profile data declarative hybrid sources',
    },
    {
      title: 'Component references',
      path: '/components',
      body: 'component api custom elements metadata',
    },
    {
      title: 'Case study: scope ownership',
      path: '/architecture/scope-ownership',
      body: 'architecture decision scope ownership cleanup lifecycle',
    },
  ];
  for (const [key, value] of entries(data.metadata['components'])) {
    if (!isRecord(value)) continue;
    const tag = text(value['tag']);
    searchItems.push({
      title: `<${tag}>`,
      path: `/components/${tag}`,
      body: `${tag} ${fields(value['useFor'], 'value').join(' ')} ${fields(value['tokenReads'], 'token').join(' ')}`,
    });
  }
  const tokens = Array.isArray(data.inspection['tokens'])
    ? data.inspection['tokens'].filter(isRecord)
    : [];
  for (const token of tokens) {
    const name = text(token['name']);
    searchItems.push({
      title: name,
      path: `/foundations/${foundationOf(name)}`,
      body: `${name} ${text(token['cssVariable'])} ${typeof token['value'] === 'string' ? token['value'] : ''}`,
    });
  }
  const results = searchItems.filter(
    (item) => !query || `${item.title} ${item.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  const resultSection = section(query ? `${results.length} results` : 'Browse indexed pages');
  if (!results.length)
    resultSection.append(
      node(
        'p',
        undefined,
        'No local results. Try “spacing”, “side navigation”, or a component tag.',
      ),
    );
  else {
    const list = node('ul');
    for (const item of results) {
      const li = node('li');
      li.append(makeLink(item.title, item.path));
      list.append(li);
    }
    resultSection.append(list);
  }
  main.append(resultSection);
}

function renderCaseStudy(main: HTMLElement): void {
  main.append(
    pageHeader(
      'Architecture case study',
      'Scope ownership for navigation',
      'A concrete decision: make route work belong to the active application lifetime, instead of leaving document-level listeners behind.',
    ),
  );
  const decision = section('Decision');
  decision.append(
    node(
      'p',
      undefined,
      'The router is an application service activated by createApp. The app run owns the router scope; each matched route level owns its own work. A transition loads new levels before committing the URL, while a superseded transition is aborted and cannot later replace the current page.',
    ),
  );
  const contractLink = makeLink(
    'Read the Scope and router contracts',
    '/docs/architecture/core-contracts.md',
  );
  contractLink.rel = 'external';
  decision.append(contractLink);
  main.append(decision);

  const consequences = section('Consequences and evidence');
  const list = node('ul');
  for (const consequence of [
    'The active route can be stopped as a unit.',
    'A new route can reuse matched parent levels.',
    'Late results from canceled navigation do not commit.',
  ])
    list.append(node('li', undefined, consequence));
  consequences.append(list);
  consequences.append(
    node(
      'p',
      undefined,
      'The router contract and browser tests cover cancellation, back/forward, native anchor escapes, focus, announcements, and scroll restoration. This trades a small amount of route setup for explicit lifetimes and predictable cleanup.',
    ),
  );
  main.append(consequences);

  const snippet = section('Minimal shell');
  const pre = node('pre');
  pre.textContent =
    'const router = createRouter({ routes });\ncreateApp({ root, setup: ({ use }) => void use(router) }).start();';
  snippet.append(pre);
  main.append(snippet);
}

// The server renders authored pages: one reached in the client loads its document; the document
// it loads says so to its first route, so a path never loads in a loop.
const RELOAD = 'oddkin-docs-reload';
let reloadedFor = sessionStorage.getItem(RELOAD);
sessionStorage.removeItem(RELOAD);

function loadedFor(path: string): boolean {
  const again = reloadedFor === path;
  reloadedFor = null;
  return again;
}

function reload(path: string): void {
  sessionStorage.setItem(RELOAD, path);
  location.reload();
}

function renderRoute(state: RouterState): void {
  const main = document.querySelector<HTMLElement>('#main');
  const column = document.querySelector<HTMLElement>('#content');
  const status = document.querySelector<HTMLElement>('#route-status');
  if (!main || !column || !status)
    throw new Error('Docs shell is missing its main, content column, or route status region.');

  status.textContent = state.navigating ? 'Loading the requested page…' : '';
  main.setAttribute('aria-busy', state.navigating ? 'true' : 'false');
  if (state.location) showRoute(state.location.path);
  if (state.status === 'idle' && state.matches.length === 0) return;
  if (state.navigating && state.matches.length === 0) return;

  const last = state.matches.at(-1);
  const page = last && pageRoutes.get(last.route);
  if (page) {
    // The authored page stays as it is while the next route loads.
    if (state.navigating) return;
    // The server renders authored pages; a page reached in the client loads its document, once.
    const again = loadedFor(page.path);
    if (main.dataset['page'] !== page.path && !again) reload(page.path);
    else main.setAttribute('aria-busy', 'false');
    return;
  }
  delete main.dataset['page'];
  // Only the home (an authored document) fills the width; the client's pages are constrained.
  column.closest('odd-container')?.setAttribute('measure', 'constrained');
  if (state.status === 'error' || last?.status === 'error') {
    const error =
      state.status === 'error' ? state.error : last?.status === 'error' ? last.error : undefined;
    const content = pageHeader(
      'Page unavailable',
      'Documentation could not be loaded',
      displayError(error),
    );
    const retry = node('button', undefined, 'Retry loading docs');
    retry.type = 'button';
    retry.addEventListener('click', () => void router.refresh());
    content.append(retry);
    column.replaceChildren(content);
    return;
  }
  if (state.status === 'not-found' || !last) {
    column.replaceChildren(
      pageHeader(
        'Not found',
        'Page not found',
        'The requested documentation page is not in the local page index.',
      ),
    );
    return;
  }

  const parent = state.matches[0];
  if (parent?.status !== 'ready' || !isRecord(parent.data))
    throw new Error('The docs index route did not provide its loaded data.');
  const data = parent.data as unknown as DocsData;
  if (last.route === componentsRoute) {
    // A filter change from the catalog itself keeps the panel (and the focus in its search field).
    const filter = last.search as CatalogFilter;
    const current = column.querySelector('oddkin-catalog-panel');
    if (current) {
      current.query = filter.query;
      current.category = filter.category;
      main.setAttribute('aria-busy', 'false');
      return;
    }
  }
  column.replaceChildren();
  main.setAttribute('aria-busy', 'false');
  if (last.route === layoutGuideRoute) renderLayoutGuide(column, data);
  else if (last.route === componentsRoute)
    renderComponents(column, last.data as WorkbenchIndex, last.search as CatalogFilter);
  else if (last.route === componentRoute) {
    const tag = String(record(last.params)['tag']);
    const { index, page } = last.data as {
      index: WorkbenchIndex;
      page: ComponentPageData | undefined;
    };
    if (!page) {
      column.replaceChildren(
        pageHeader(
          'Not found',
          'Component not found',
          `No published component has the tag <${tag}>.`,
        ),
      );
      return;
    }
    const entry = index.registry.pages.find((p) => p.id === page.id);
    column.replaceChildren(
      pageHeader(
        `${entry?.group ?? 'Components'} · ${tag}`,
        entry?.title ?? `<${tag}>`,
        entry?.summary,
      ),
      componentMeta(page),
      ...componentTabs(referencePanel(index, page)),
    );
  } else if (last.route === aiRoute)
    renderAi(
      column,
      last.data as AiData,
      pageHeader('@oddkin/ai', 'AI interfaces', AI_DESCRIPTION),
      panelHref,
    );
  else if (last.route === caseStudyRoute) renderCaseStudy(column);
  else if (last.route === searchRoute) renderSearch(column, String(last.search ?? ''), data);
  else if (last.route === notFoundRoute)
    column.replaceChildren(
      pageHeader(
        'Not found',
        'Page not found',
        'The requested documentation page is not in the local page index.',
      ),
    );
  else throw new Error('The docs router matched an unhandled page route.');
  main.setAttribute('aria-busy', 'false');
}

const root = document.querySelector<HTMLElement>('#docs-app');
if (!root) throw new Error('Docs shell is missing #docs-app.');

createApp({
  name: 'oddkin-docs',
  root,
  setup({ use, scope }) {
    use(router);
    startShell(scope, (path) => void router.navigate(path));
    scope.effect(() => renderRoute(router.state.value));
  },
}).start();

export const docsRoutes = [docsRoute] as const;
