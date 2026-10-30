import { createScope } from '@oddkin/core/scope';
import type { ComponentPageData, WorkbenchIndex } from '@oddkin/workbench/data';
import type { PageEntry } from '@oddkin/workbench/pages';

/**
 * The component catalog and reference pages (Figma "03 · Reference"): the Workbench panels over
 * Workbench data built in Node from the packages' metadata and authored examples (`/_oddkin/`,
 * apps/docs/oddkin.config.ts), with live examples in same-origin frames (frame.html).
 */

const DATA = '/_oddkin/';
export const FRAME_URL = '/apps/docs/frame.html';
/** The AI elements have their own page (/ai); the catalog lists every other category. */
export const AI_GROUP = 'AI';

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function json(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, signal ? { signal } : {});
  if (!response.ok) throw new Error(`Could not load ${path}: HTTP ${response.status}.`);
  return response.json();
}

// The data is static for a build: a route that has it already commits without waiting for the
// network, where the frames' module loads may hold every connection.
let indexLoaded: WorkbenchIndex | undefined;
const pagesLoaded = new Map<string, ComponentPageData>();

export async function loadIndex(signal: AbortSignal): Promise<WorkbenchIndex> {
  if (indexLoaded) return indexLoaded;
  const index = await json(`${DATA}index.json`, signal);
  if (!isRecord(index) || !isRecord(index['registry']) || !isRecord(index['pages']))
    throw new Error('The reference index has no page registry.');
  return (indexLoaded = index as unknown as WorkbenchIndex);
}

export async function loadComponent(
  index: WorkbenchIndex,
  tag: string,
  signal?: AbortSignal,
): Promise<ComponentPageData | undefined> {
  const file = index.pages[`components/${tag}`];
  if (!file) return undefined;
  const known = pagesLoaded.get(file);
  if (known) return known;
  const page = await json(`${DATA}${file}`, signal);
  if (!isRecord(page) || page['kind'] !== 'component') return undefined;
  pagesLoaded.set(file, page as unknown as ComponentPageData);
  return page as unknown as ComponentPageData;
}

/** Catalog groups to list: every category but the AI elements. */
export const catalogGroups = (index: WorkbenchIndex): string[] => [
  ...new Set(
    index.registry.pages
      .filter((page) => page.kind === 'component' && page.group && page.group !== AI_GROUP)
      .map((page) => page.group as string),
  ),
];

/** A reference page's source file in the repository: a package's `dist/<path>.js` is `src/<path>.ts`. */
export const sourcePath = (page: { package: string; module: string }): string =>
  `packages/${page.package.replace(/^@oddkin\//, '')}/${page.module.replace(/^dist\//, 'src/').replace(/\.js$/, '.ts')}`;

interface ExampleValues {
  attributes: Json;
  properties: Json;
  slots: Json;
}

/** An authored example's values (`definition`), with or without a fixture. */
function definitionValues(example: Json | undefined): ExampleValues | undefined {
  const definition = isRecord(example?.['definition']) ? example['definition'] : undefined;
  if (!definition) return undefined;
  const record = (value: unknown) => (isRecord(value) ? value : {});
  return {
    attributes: record(definition['attributes']),
    properties: record(definition['props']),
    slots: record(definition['slots']),
  };
}

/** An authored example's values, when it needs no fixture. */
function exampleValues(example: Json | undefined): ExampleValues | undefined {
  const definition = isRecord(example?.['definition']) ? example['definition'] : undefined;
  return definition?.['hasFixture'] === true ? undefined : definitionValues(example);
}

const incorrect = (example: Json) =>
  isRecord(example['incorrect']) ||
  (isRecord(example['definition']) && isRecord(example['definition']['incorrect']));

/** A preview never opens an overlay over the page. */
const opensNothing = (values: ExampleValues | undefined) =>
  values && values.properties['open'] !== true && !('open' in values.attributes)
    ? values
    : undefined;

const defaultValues = (page: ComponentPageData) =>
  exampleValues(page.examples.find((entry) => entry['name'] === 'default'));

/** An example a preview draws: its name (for its fixture), values, and whether it has a fixture. */
export interface PreviewExample {
  readonly name: string;
  readonly values: ExampleValues;
  readonly fixture: boolean;
}

/** A correct example that opens nothing, as a preview draws it. */
function previewable(example: Json | undefined): PreviewExample | undefined {
  if (!example || incorrect(example)) return undefined;
  const values = opensNothing(definitionValues(example));
  const name = example['name'];
  if (!values || typeof name !== 'string') return undefined;
  const definition = example['definition'] as Json;
  return { name, values, fixture: definition['hasFixture'] === true };
}

/** A catalog card's example: the `default` one, or else the first correct one that opens nothing. */
export const previewExample = (page: ComponentPageData): PreviewExample | undefined =>
  previewable(page.examples.find((example) => example['name'] === 'default')) ??
  page.examples.map(previewable).find((example) => example !== undefined);

/**
 * A component's example as an element (its `default` unless `values` are given): its registration
 * loaded, then its attributes, properties, and (unless `slots` is false) slot text. Undefined
 * when it has no such example.
 */
export async function exampleElement(
  page: ComponentPageData,
  { slots = true, values = defaultValues(page) }: { slots?: boolean; values?: ExampleValues } = {},
): Promise<HTMLElement | undefined> {
  const registration = page.enrichment?.['registration'];
  if (typeof registration !== 'string' || !values) return undefined;
  await import(registration);
  const element = document.createElement(page.tag);
  for (const [name, value] of Object.entries(values.attributes))
    if (typeof value === 'string') element.setAttribute(name, value);
  for (const [name, value] of Object.entries(values.properties)) Reflect.set(element, name, value);
  if (!slots) return element;
  for (const [slot, text] of Object.entries(values.slots)) {
    if (typeof text !== 'string') continue;
    if (slot === 'default') element.append(text);
    else {
      const part = document.createElement('span');
      part.slot = slot;
      part.textContent = text;
      element.append(part);
    }
  }
  return element;
}

let componentSheets: CSSStyleSheet[] | undefined;

/** Copies of the page's Oddkin component stylesheets (layout, type, buttons), for shadow roots. */
function pageSheets(): CSSStyleSheet[] {
  return (componentSheets ??= [...document.styleSheets]
    .filter((sheet) => sheet.href?.includes('/@oddkin/components/css/'))
    .map((sheet) => {
      const copy = new CSSStyleSheet();
      copy.replaceSync(
        [...sheet.cssRules]
          .filter((rule) => !(rule instanceof CSSImportRule))
          .map((rule) => rule.cssText)
          .join('\n'),
      );
      return copy;
    }));
}

/**
 * Inert hosts, one per key, that draw their content when they first scroll into view. Each draws
 * in a shadow root with the page's component stylesheets: the panels that show the hosts keep
 * them in shadow roots of their own, where the page's layout classes do not reach.
 */
function lazyHosts(className: string) {
  const hosts = new Map<string, HTMLElement>();
  const pending = new Map<Element, () => Promise<void>>();
  const observer = new IntersectionObserver((records) => {
    for (const record of records) {
      const build = pending.get(record.target);
      if (!record.isIntersecting || !build) continue;
      pending.delete(record.target);
      observer.unobserve(record.target);
      build().catch(reportError);
    }
  });
  return (
    key: string,
    draw: (host: HTMLElement, root: ShadowRoot) => Promise<void>,
  ): HTMLElement => {
    let host = hosts.get(key);
    if (!host) {
      const created = document.createElement('div');
      created.className = className;
      created.inert = true;
      // Words break as on a page, not anywhere as in the card around the preview.
      created.style.overflowWrap = 'normal';
      const root = created.attachShadow({ mode: 'open' });
      root.adoptedStyleSheets = pageSheets();
      hosts.set(key, created);
      pending.set(created, () => draw(created, root));
      observer.observe(created);
      host = created;
    }
    return host;
  };
}

interface ExampleModule {
  readonly default?: {
    readonly examples?: Readonly<
      Record<string, { readonly fixture?: (context: object) => unknown } | undefined>
    >;
  };
  /** `render` from `@oddkin/core/template`, which Workbench adds to the module it serves. */
  readonly oddkinFrameRender?: (content: unknown, host: Element) => unknown;
}

/**
 * Runs an example's fixture as a preview frame does, beside `element` in `root`. A preview is a
 * still picture: the fixture's listeners and timers stop once it has drawn.
 */
async function runFixture(
  page: ComponentPageData,
  name: string,
  element: HTMLElement,
  root: ShadowRoot,
): Promise<void> {
  if (!page.exampleModule) return;
  const module = (await import(page.exampleModule)) as ExampleModule;
  const fixture = module.default?.examples?.[name]?.fixture;
  if (typeof fixture !== 'function') return;
  const scope = createScope({ name: `docs-preview:${page.tag}` });
  try {
    await fixture({
      scope,
      element,
      mount(content: unknown) {
        const box = document.createElement('div');
        root.append(box);
        if (content instanceof Node) box.append(content);
        else module.oddkinFrameRender?.(content, box);
        return box.firstElementChild ?? box;
      },
    });
    await (element as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  } finally {
    scope.dispose();
  }
  // A preview never opens an overlay over the page, even one its setup opens.
  if (Reflect.get(element, 'open') === true) Reflect.set(element, 'open', false);
}

/** Fields and block layouts take the card's width: centred at their own, some would not show. */
const FILL = new Set(
  [
    'input',
    'textarea',
    'select',
    'combobox',
    'slider',
    'progress',
    'date-picker',
    'color-picker',
    'file-input',
    'skeleton',
    'carousel',
    'container',
    'empty-state',
    'scroll-region',
    'split-panel',
    'tabs',
    'tab-panel',
    'validation-summary',
  ].map((name) => `odd-${name}`),
);

/** Draws an example in `root`: its element, then what its fixture sets up. */
async function drawExample(
  page: ComponentPageData,
  example: PreviewExample,
  host: HTMLElement,
  root: ShadowRoot,
): Promise<void> {
  const element = await exampleElement(page, { values: example.values });
  if (!element) return;
  if (FILL.has(page.tag)) host.style.inlineSize = '100%';
  root.replaceChildren(element);
  if (example.fixture) await runFixture(page, example.name, element, root);
}

/**
 * Live previews for the catalog's cards: each component's preview example. Inert: the card's
 * link is its only stop.
 */
export function catalogPreviews(index: WorkbenchIndex): (entry: PageEntry) => Node | undefined {
  const host = lazyHosts('catalog-preview');
  return (entry) =>
    entry.kind === 'component'
      ? host(entry.id, async (into, root) => {
          const page = await loadComponent(index, entry.id.replace(/^components\//, ''));
          const example = page && previewExample(page);
          if (page && example) await drawExample(page, example, into, root);
        })
      : undefined;
}

/**
 * Specimens for the example cards of a reference page (`example:<tag>/<name>`): the example's
 * element and what its fixture sets up, for correct examples that open nothing; an incorrect
 * example shows one only when it needs no fixture.
 */
export function examplePreviews(): (page: ComponentPageData, id: string) => Node | undefined {
  const host = lazyHosts('example-preview');
  return (page, id) => {
    const entry = page.examples.find((e) => e['id'] === id);
    const values = opensNothing(exampleValues(entry));
    const example =
      previewable(entry) ??
      (values && typeof entry?.['name'] === 'string'
        ? { name: entry['name'], values, fixture: false }
        : undefined);
    return example ? host(id, (into, root) => drawExample(page, example, into, root)) : undefined;
  };
}
