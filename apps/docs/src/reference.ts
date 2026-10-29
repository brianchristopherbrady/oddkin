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

/** An authored example's values, when it needs no fixture and is not an incorrect one. */
function exampleValues(example: Json | undefined): ExampleValues | undefined {
  const definition = isRecord(example?.['definition']) ? example['definition'] : undefined;
  if (!definition || definition['hasFixture'] === true) return undefined;
  if (isRecord(definition['incorrect']) || isRecord(example?.['incorrect'])) return undefined;
  const record = (value: unknown) => (isRecord(value) ? value : {});
  return {
    attributes: record(definition['attributes']),
    properties: record(definition['props']),
    slots: record(definition['slots']),
  };
}

const defaultValues = (page: ComponentPageData) =>
  exampleValues(page.examples.find((entry) => entry['name'] === 'default'));

/**
 * A catalog card's values: the `default` example, or else the first authored example that needs
 * no fixture (fixtures run only in the test runner) and opens nothing (a card never opens an
 * overlay).
 */
export const previewValues = (page: ComponentPageData) =>
  defaultValues(page) ??
  page.examples
    .map(exampleValues)
    .find(
      (values) => values && values.properties['open'] !== true && !('open' in values.attributes),
    );

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

/** Builds a component's preview example in `host`. */
async function renderPreview(host: HTMLElement, index: WorkbenchIndex, entry: PageEntry) {
  const page = await loadComponent(index, entry.id.replace(/^components\//, ''));
  const values = page && previewValues(page);
  const element = page && values && (await exampleElement(page, { values }));
  if (element) host.replaceChildren(element);
}

/**
 * Live previews for the catalog's cards: each component's default example, built when its card
 * first scrolls into view. Previews are inert: the card's link is its only stop.
 */
export function catalogPreviews(index: WorkbenchIndex): (entry: PageEntry) => Node | undefined {
  const hosts = new Map<string, HTMLElement>();
  const pending = new Map<Element, PageEntry>();
  const observer = new IntersectionObserver((records) => {
    for (const record of records) {
      const entry = pending.get(record.target);
      if (!record.isIntersecting || !entry) continue;
      pending.delete(record.target);
      observer.unobserve(record.target);
      renderPreview(record.target as HTMLElement, index, entry).catch(reportError);
    }
  });
  return (entry) => {
    if (entry.kind !== 'component') return undefined;
    let host = hosts.get(entry.id);
    if (!host) {
      host = document.createElement('div');
      host.className = 'catalog-preview';
      host.inert = true;
      hosts.set(entry.id, host);
      pending.set(host, entry);
      observer.observe(host);
    }
    return host;
  };
}
