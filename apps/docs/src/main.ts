import { createApp } from '@oddkin/app/app';
import { createRouter, route, type AnyRoute, type RouterState } from '@oddkin/app/router';
import { componentSnippet, tokenCssSnippet } from './snippets.js';

type JsonRecord = Record<string, unknown>;

interface DocsData {
  readonly metadata: JsonRecord;
  readonly customElements: JsonRecord;
  readonly inspection: JsonRecord;
}

interface PanelPageData {
  readonly kind: 'component' | 'foundation';
  readonly id: string;
  readonly data: DocsData;
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
  const [metadata, customElements, inspection] = await Promise.all([
    publishedJson('/public/@oddkin/components/oddkin.metadata.json', signal),
    publishedJson('/public/@oddkin/components/custom-elements.json', signal),
    publishedJson('/public/@oddkin/tokens/inspect/default.json', signal),
  ]);
  if (!isRecord(metadata['components']) || !isRecord(metadata['foundations']))
    throw new Error('Published Oddkin metadata is missing its components or foundations index.');
  if (!Array.isArray(inspection['tokens']))
    throw new Error('Published token inspection data has no token list.');
  return { metadata, customElements, inspection };
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

class OddkinDocPanel extends HTMLElement {
  pageData: PanelPageData | undefined;
  index: DocsData | undefined;
  href: (route: string) => string = (path) => path;
  readonly #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  render(): void {
    const page = this.pageData;
    const data = this.index;
    if (!page || !data) return;

    const wrapper = node('section', 'detail-panel');
    const stylesheet = node('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/apps/docs/styles.css';
    this.#root.replaceChildren(stylesheet, wrapper);

    if (page.kind === 'component') this.renderComponent(wrapper, page, data);
    else this.renderFoundation(wrapper, page, data);
  }

  renderComponent(parent: HTMLElement, page: PanelPageData, data: DocsData): void {
    const component = record(record(data.metadata['components'])[page.id]);
    const tag = text(component['tag']);
    const declaration = componentDeclaration(data, tag);
    const header = node('header');
    header.append(node('p', 'eyebrow', 'Component reference'));
    header.append(node('h2', undefined, `<${tag}>`));
    appendText(header, 'p', declaration?.['description']);
    for (const line of strings(component['useFor'])) appendText(header, 'p', line);
    parent.append(header);

    const members = Array.isArray(declaration?.['members'])
      ? declaration['members'].filter(isRecord).filter((member) => member['kind'] === 'field')
      : [];
    parent.append(node('h3', undefined, 'Properties'));
    if (members.length) {
      const table = node('table');
      const head = node('thead');
      const heading = node('tr');
      for (const label of ['Property', 'Type', 'Default', 'Attribute'])
        heading.append(node('th', undefined, label));
      head.append(heading);
      table.append(head);
      const body = node('tbody');
      for (const member of members) {
        const row = node('tr');
        row.append(node('th', undefined, text(member['name'], 'Unknown')));
        row.append(
          node(
            'td',
            undefined,
            isRecord(member['type'])
              ? text(member['type']['text'], 'Not documented')
              : 'Not documented',
          ),
        );
        row.append(node('td', undefined, text(member['default'], 'Not documented')));
        row.append(node('td', undefined, text(member['attribute'], '—')));
        body.append(row);
      }
      table.append(body);
      parent.append(table);
    } else {
      parent.append(
        node('p', undefined, 'No public properties are listed in the published manifest.'),
      );
    }

    const slots = Array.isArray(declaration?.['slots'])
      ? declaration['slots'].filter(isRecord)
      : [];
    parent.append(node('h3', undefined, 'Slots'));
    if (slots.length) {
      const list = node('ul');
      for (const slot of slots)
        list.append(
          node(
            'li',
            undefined,
            `${text(slot['name']) || '(default)'}: ${text(slot['description'], 'No description published.')}`,
          ),
        );
      parent.append(list);
    } else parent.append(node('p', undefined, 'No slots are listed in the published manifest.'));

    const tokenReads = Array.isArray(component['tokenReads']) ? component['tokenReads'] : [];
    parent.append(node('h3', undefined, 'Token references'));
    if (tokenReads.length) {
      const list = node('ul');
      for (const token of tokenReads) {
        if (isRecord(token)) list.append(node('li', undefined, text(token['token'])));
      }
      parent.append(list);
    } else parent.append(node('p', undefined, 'No token reads are listed.'));

    parent.append(node('h3', undefined, 'Copied snippet'));
    const snippet = node('pre');
    snippet.textContent = componentSnippet(text(component['registration']), tag);
    parent.append(snippet);

    const more = node('p', 'panel-link');
    const directory = node('a', undefined, 'Browse all components');
    directory.href = this.href('/components');
    more.append(directory);
    parent.append(more);
    parent.append(this.workbenchLink());
  }

  renderFoundation(parent: HTMLElement, page: PanelPageData, data: DocsData): void {
    const foundation = record(record(data.metadata['foundations'])[page.id]);
    const tokenNames = strings(foundation['tokens']);
    const inspected = Array.isArray(data.inspection['tokens'])
      ? data.inspection['tokens'].filter(isRecord)
      : [];
    parent.append(node('p', 'eyebrow', 'Foundation reference'));
    parent.append(node('h2', undefined, text(foundation['id'], page.id)));
    parent.append(
      node(
        'p',
        undefined,
        `Published metadata identifies ${tokenNames.length} tokens for this foundation. Values below come from @oddkin/tokens inspection data.`,
      ),
    );
    const table = node('table');
    const head = node('thead');
    const heading = node('tr');
    for (const label of ['Token', 'CSS variable', 'Value', 'Origin'])
      heading.append(node('th', undefined, label));
    head.append(heading);
    table.append(head);
    const body = node('tbody');
    for (const name of tokenNames) {
      const token = inspected.find((item) => item['name'] === name);
      if (!token) continue;
      const row = node('tr');
      row.append(node('th', undefined, name));
      row.append(node('td', undefined, text(token['cssVariable'], '—')));
      row.append(
        node(
          'td',
          undefined,
          typeof token['value'] === 'string' ? token['value'] : JSON.stringify(token['value']),
        ),
      );
      row.append(node('td', undefined, text(token['origin'], 'unknown')));
      body.append(row);
    }
    table.append(body);
    parent.append(table);
    parent.append(this.workbenchLink());
  }

  workbenchLink(): HTMLElement {
    const paragraph = node('p', 'panel-link');
    const link = node('a', undefined, 'Explore interactive tooling in the Workbench package');
    link.href = 'https://github.com/brianchristopherbrady/oddkin/tree/main/packages/workbench';
    link.rel = 'external';
    paragraph.append(link);
    return paragraph;
  }
}

export function defineDocPanels(): void {
  if (!customElements.get('oddkin-doc-panel'))
    customElements.define('oddkin-doc-panel', OddkinDocPanel);
}

const gettingStartedRoute = route({ path: '', title: 'Getting started' });
const tokensGuideRoute = route({ path: 'getting-started', title: 'Getting started with tokens' });
const layoutGuideRoute = route({ path: 'layout/side-nav', title: 'Side navigation layout guide' });
const foundationsRoute = route({ path: 'foundations', title: 'Foundations' });
const foundationRoute = route({
  path: 'foundations/:id',
  params: ({ id }) => (id ? { id } : undefined),
  title: ({ params }) => `Foundation: ${params.id}`,
});
const componentsRoute = route({ path: 'components', title: 'Components' });
const componentRoute = route({
  path: 'components/:tag',
  params: ({ tag }) => (tag && /^[a-z0-9-]+$/.test(tag) ? { tag } : undefined),
  title: ({ params }) => `<${params.tag}>`,
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
    gettingStartedRoute,
    tokensGuideRoute,
    layoutGuideRoute,
    foundationsRoute,
    foundationRoute,
    componentsRoute,
    componentRoute,
    caseStudyRoute,
    searchRoute,
    notFoundRoute,
  ],
});

const router = createRouter({
  routes: [docsRoute as AnyRoute],
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

function renderGettingStarted(main: HTMLElement): void {
  main.append(
    pageHeader(
      'Documentation',
      'Getting started',
      'Start with Oddkin tokens: use the published CSS variables to keep your interface aligned with the active theme.',
    ),
  );
  const first = section('Use design tokens');
  first.append(
    node(
      'p',
      undefined,
      'Load the published token stylesheet, then reference semantic variables in your own CSS. This starting guide stays token-only; component packages are optional.',
    ),
  );
  first.append(
    node(
      'p',
      undefined,
      'Load the published stylesheet from the @oddkin/tokens ./css/default.css export before applying these declarations.',
    ),
  );
  const pre = node('pre');
  const code = node('code');
  code.textContent = tokenCssSnippet;
  pre.append(code);
  first.append(pre);
  first.append(makeLink('Read the token reference', '/foundations/spacing'));
  main.append(first);

  const more = section('Continue learning');
  more.append(makeLink('Layout guide: side navigation', '/layout/side-nav'));
  more.append(document.createTextNode(' · '));
  more.append(makeLink('Browse foundations', '/foundations'));
  more.append(document.createTextNode(' · '));
  more.append(makeLink('Browse components', '/components'));
  main.append(more);
}

function renderFoundations(main: HTMLElement, data: DocsData): void {
  main.append(
    pageHeader(
      'Foundations',
      'Design foundations',
      'Published design-system facts, with token values sourced from the generated inspection.',
    ),
  );
  const grid = node('div', 'card-grid');
  for (const [key, value] of entries(data.metadata['foundations'])) {
    const foundation = isRecord(value) ? value : {};
    const id = text(foundation['id'], key.replace(/^foundation:/, ''));
    const card = node('article', 'doc-card');
    card.append(node('h2', undefined, id));
    card.append(
      node('p', undefined, `${strings(foundation['tokens']).length} published token references`),
    );
    card.append(makeLink(`Read ${id}`, `/foundations/${id}`));
    grid.append(card);
  }
  main.append(grid);
}

function renderComponents(main: HTMLElement, data: DocsData): void {
  main.append(
    pageHeader(
      'Components',
      'Component references',
      'Reference pages use the published Custom Elements Manifest and Oddkin metadata. No component implementation is loaded.',
    ),
  );
  const grid = node('div', 'card-grid');
  for (const [key, value] of entries(data.metadata['components'])) {
    if (!isRecord(value)) continue;
    const tag = text(value['tag']);
    const categoryValue = record(data.metadata['categories'])[text(value['category'])];
    const category = text(
      isRecord(categoryValue) ? categoryValue['label'] : undefined,
      'Component',
    );
    const card = node('article', 'doc-card');
    card.append(node('p', 'eyebrow', category));
    card.append(node('h2', undefined, `<${tag}>`));
    card.append(node('p', undefined, strings(value['useFor']).join(' ')));
    card.append(makeLink(`Read ${tag}`, `/components/${tag}`));
    grid.append(card);
  }
  main.append(grid);
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

  const panel = node('oddkin-doc-panel');
  const custom = panel as OddkinDocPanel;
  custom.pageData = { kind: 'component', id: 'component:odd-side-nav', data };
  custom.index = data;
  custom.href = (path) => router.href(path);
  main.append(panel);
}

function renderSearch(main: HTMLElement, query: string, data: DocsData): void {
  main.append(
    pageHeader(
      'Local search',
      'Search Oddkin docs',
      'Search this page index locally; no remote service or component module is loaded.',
    ),
  );
  const form = node('form', 'search-form');
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
    {
      title: 'Getting started with tokens',
      path: '/getting-started',
      body: 'tokens CSS design variables',
    },
    {
      title: 'Side navigation layout guide',
      path: '/layout/side-nav',
      body: 'layout recipe regions conditions profile data declarative hybrid sources',
    },
    {
      title: 'Design foundations',
      path: '/foundations',
      body: 'foundations color spacing borders radii',
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
      body: `${tag} ${strings(value['useFor']).join(' ')} ${strings(value['tokenReads']).join(' ')}`,
    });
  }
  for (const [key, value] of entries(data.metadata['foundations'])) {
    if (!isRecord(value)) continue;
    const id = text(value['id'], key.replace(/^foundation:/, ''));
    searchItems.push({
      title: `${id} foundation`,
      path: `/foundations/${id}`,
      body: `${id} ${strings(value['tokens']).join(' ')}`,
    });
  }
  const tokens = Array.isArray(data.inspection['tokens'])
    ? data.inspection['tokens'].filter(isRecord)
    : [];
  for (const token of tokens) {
    const name = text(token['name']);
    searchItems.push({
      title: name,
      path: `/foundations/${
        name.startsWith('space.')
          ? 'spacing'
          : name.startsWith('border.') || name.startsWith('radius.')
            ? 'borders-and-radii'
            : 'color'
      }`,
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

function renderRoute(state: RouterState): void {
  const main = document.querySelector<HTMLElement>('#main');
  const status = document.querySelector<HTMLElement>('#route-status');
  if (!main || !status) throw new Error('Docs shell is missing its main or route status region.');

  status.textContent = state.navigating ? 'Loading the requested page…' : '';
  main.setAttribute('aria-busy', state.navigating ? 'true' : 'false');
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.side-nav a')) {
    const path = new URL(link.href).pathname;
    const currentPath = state.location?.path;
    const onGettingStarted =
      (currentPath === '/' || currentPath === '/getting-started') && path === '/getting-started';
    if (onGettingStarted || (currentPath && path === router.href(currentPath)))
      link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (state.status === 'idle' && state.matches.length === 0) return;
  if (state.navigating && state.matches.length === 0) return;

  const last = state.matches.at(-1);
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
    main.replaceChildren(content);
    return;
  }
  if (state.status === 'not-found' || !last) {
    main.replaceChildren(
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
  main.replaceChildren();
  const data: DocsData = {
    metadata: record(parent.data['metadata']),
    customElements: record(parent.data['customElements']),
    inspection: record(parent.data['inspection']),
  };
  main.setAttribute('aria-busy', 'false');
  if (last.route === gettingStartedRoute || last.route === tokensGuideRoute)
    renderGettingStarted(main);
  else if (last.route === layoutGuideRoute) renderLayoutGuide(main, data);
  else if (last.route === foundationsRoute) renderFoundations(main, data);
  else if (last.route === componentsRoute) renderComponents(main, data);
  else if (last.route === foundationRoute) {
    const id = record(last.params)['id'];
    const key = `foundation:${String(id)}`;
    if (!isRecord(record(data.metadata['foundations'])[key])) {
      main.replaceChildren(
        pageHeader(
          'Not found',
          'Foundation not found',
          `No published foundation has the id “${String(id)}”.`,
        ),
      );
      return;
    }
    main.replaceChildren(pageHeader('Foundations', 'Foundation reference'));
    const panel = node('oddkin-doc-panel') as OddkinDocPanel;
    panel.pageData = { kind: 'foundation', id: key, data };
    panel.index = data;
    panel.href = (path) => router.href(path);
    main.append(panel);
  } else if (last.route === componentRoute) {
    const tag = String(record(last.params)['tag']);
    const key = `component:${tag}`;
    if (!isRecord(record(data.metadata['components'])[key])) {
      main.replaceChildren(
        pageHeader(
          'Not found',
          'Component not found',
          `No published component has the tag <${tag}>.`,
        ),
      );
      return;
    }
    main.replaceChildren(pageHeader('Components', `<${tag}>`));
    const panel = node('oddkin-doc-panel') as OddkinDocPanel;
    panel.pageData = { kind: 'component', id: key, data };
    panel.index = data;
    panel.href = (path) => router.href(path);
    main.append(panel);
  } else if (last.route === caseStudyRoute) renderCaseStudy(main);
  else if (last.route === searchRoute) renderSearch(main, String(last.search ?? ''), data);
  else if (last.route === notFoundRoute)
    main.replaceChildren(
      pageHeader(
        'Not found',
        'Page not found',
        'The requested documentation page is not in the local page index.',
      ),
    );
  else throw new Error('The docs router matched an unhandled page route.');
  main.setAttribute('aria-busy', 'false');
}

defineDocPanels();
const root = document.querySelector<HTMLElement>('#docs-app');
if (!root) throw new Error('Docs shell is missing #docs-app.');

createApp({
  name: 'oddkin-docs',
  root,
  setup({ use, scope }) {
    use(router);
    const headerSearch = document.querySelector<HTMLFormElement>('.header-search');
    const headerSearchInput = document.querySelector<HTMLInputElement>('#site-search');
    if (!headerSearch || !headerSearchInput)
      throw new Error('Docs shell is missing its header search form or input.');
    scope.listen<SubmitEvent>(headerSearch, 'submit', (event) => {
      event.preventDefault();
      void router.navigate(`/search?q=${encodeURIComponent(headerSearchInput.value.trim())}`);
    });
    scope.effect(() => renderRoute(router.state.value));
  },
}).start();

export const docsRoutes = [docsRoute] as const;
