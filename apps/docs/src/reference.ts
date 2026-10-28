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

/** The values of a component's `default` example, when it has some and needs no fixture. */
function defaultExample(page: ComponentPageData) {
  const example = page.examples.find((entry) => entry['name'] === 'default');
  const definition = isRecord(example?.['definition']) ? example['definition'] : undefined;
  if (!definition || definition['hasFixture'] === true) return undefined;
  const record = (value: unknown) => (isRecord(value) ? value : {});
  return {
    attributes: record(definition['attributes']),
    properties: record(definition['props']),
    slots: record(definition['slots']),
  };
}

/** Builds a component's default example in `host`: its registration, attributes, properties, and slot text. */
async function renderPreview(host: HTMLElement, index: WorkbenchIndex, entry: PageEntry) {
  const tag = entry.id.replace(/^components\//, '');
  const page = await loadComponent(index, tag);
  const registration = page?.enrichment?.['registration'];
  const values = page && defaultExample(page);
  if (!page || typeof registration !== 'string' || !values) return;
  await import(registration);
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(values.attributes))
    if (typeof value === 'string') element.setAttribute(name, value);
  for (const [name, value] of Object.entries(values.properties)) Reflect.set(element, name, value);
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
  host.replaceChildren(element);
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
