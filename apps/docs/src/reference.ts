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

export async function loadIndex(signal: AbortSignal): Promise<WorkbenchIndex> {
  const index = await json(`${DATA}index.json`, signal);
  if (!isRecord(index) || !isRecord(index['registry']) || !isRecord(index['pages']))
    throw new Error('The reference index has no page registry.');
  return index as unknown as WorkbenchIndex;
}

export async function loadComponent(
  index: WorkbenchIndex,
  tag: string,
  signal?: AbortSignal,
): Promise<ComponentPageData | undefined> {
  const file = index.pages[`components/${tag}`];
  if (!file) return undefined;
  const page = await json(`${DATA}${file}`, signal);
  return isRecord(page) && page['kind'] === 'component'
    ? (page as unknown as ComponentPageData)
    : undefined;
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

/** An authored example's values, when it needs no fixture. */
function exampleValues(example: Json | undefined): ExampleValues | undefined {
  const definition = isRecord(example?.['definition']) ? example['definition'] : undefined;
  if (!definition || definition['hasFixture'] === true) return undefined;
  const record = (value: unknown) => (isRecord(value) ? value : {});
  return {
    attributes: record(definition['attributes']),
    properties: record(definition['props']),
    slots: record(definition['slots']),
  };
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

/**
 * A catalog card's values: the `default` example, or else the first correct authored example
 * that needs no fixture (fixtures run only in the test runner) and opens nothing.
 */
export const previewValues = (page: ComponentPageData) =>
  defaultValues(page) ??
  page.examples
    .filter((example) => !incorrect(example))
    .map(exampleValues)
    .find(opensNothing);

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

/** Inert hosts, one per key, that build their content when they first scroll into view. */
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
  return (key: string, render: () => Promise<Node | undefined>): HTMLElement => {
    let host = hosts.get(key);
    if (!host) {
      const created = document.createElement('div');
      created.className = className;
      created.inert = true;
      hosts.set(key, created);
      pending.set(created, async () => {
        const element = await render();
        if (element) created.replaceChildren(element);
      });
      observer.observe(created);
      host = created;
    }
    return host;
  };
}

/**
 * Live previews for the catalog's cards: each component's preview example. Inert: the card's
 * link is its only stop.
 */
export function catalogPreviews(index: WorkbenchIndex): (entry: PageEntry) => Node | undefined {
  const host = lazyHosts('catalog-preview');
  return (entry) =>
    entry.kind === 'component'
      ? host(entry.id, async () => {
          const page = await loadComponent(index, entry.id.replace(/^components\//, ''));
          const values = page && previewValues(page);
          return page && values ? exampleElement(page, { values }) : undefined;
        })
      : undefined;
}

/**
 * Specimens for the example cards of a reference page (`example:<tag>/<name>`): the example's
 * element, for examples that need no fixture and open nothing; other cards show no specimen.
 */
export function examplePreviews(): (page: ComponentPageData, id: string) => Node | undefined {
  const host = lazyHosts('example-preview');
  return (page, id) => {
    const values = opensNothing(exampleValues(page.examples.find((e) => e['id'] === id)));
    return values ? host(id, () => exampleElement(page, { values })) : undefined;
  };
}
