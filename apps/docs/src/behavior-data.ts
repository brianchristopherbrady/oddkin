import type { Scope } from '@oddkin/core/scope';
import type { ComponentPageData } from '@oddkin/workbench/data';
import type { ExampleSet } from '@oddkin/workbench/examples';
import type { FrameMountPayload, FrameSettings, JsonValue } from '@oddkin/workbench/protocol';
import { mountExample, type MountedExample } from '@oddkin/workbench/testing';
import { loadComponent, loadIndex } from './reference.js';

type RecordValue = Record<string, unknown>;
export const asRecord = (value: unknown): RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : {};

export interface BehaviorExample {
  readonly name: string;
  readonly label: string;
  readonly guidance: string;
  readonly fixture: boolean;
  readonly definition: RecordValue;
}

/** Correct authored states only; intentional usage mistakes belong to their reference pages. */
export function behaviorExamples(page: ComponentPageData): BehaviorExample[] {
  return page.examples.flatMap((example) => {
    const entry = asRecord(example);
    const definition = asRecord(entry['definition']);
    if (entry['incorrect'] || definition['incorrect'] || typeof entry['name'] !== 'string')
      return [];
    return [
      {
        name: entry['name'],
        label: typeof entry['label'] === 'string' ? entry['label'] : entry['name'],
        guidance:
          typeof entry['guidance'] === 'string'
            ? entry['guidance']
            : typeof definition['guidance'] === 'string'
              ? definition['guidance']
              : '',
        fixture: definition['hasFixture'] === true,
        definition,
      },
    ];
  });
}

export function behaviorPayload(
  page: ComponentPageData,
  example: BehaviorExample,
  settings: FrameSettings,
): FrameMountPayload {
  const registration = page.enrichment?.['registration'];
  if (typeof registration !== 'string')
    throw new Error('The component has no public registration.');
  const attributes = Object.fromEntries(
    Object.entries(asRecord(example.definition['attributes'])).filter(
      (entry): entry is [string, string | null] =>
        typeof entry[1] === 'string' || entry[1] === null,
    ),
  );
  const slots = Object.fromEntries(
    Object.entries(asRecord(example.definition['slots']))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([name, value]) => [name === 'default' ? '' : name, value]),
  );
  const declared = page.enrichment?.['events'];
  const events = Array.isArray(declared)
    ? declared.flatMap((item) => {
        const reference = asRecord(item)['event'];
        return typeof reference === 'string' ? [reference.slice(reference.indexOf('#') + 1)] : [];
      })
    : [];
  return {
    tag: page.tag,
    registration,
    example: `example:${page.tag}/${example.name}`,
    properties: asRecord(example.definition['props']) as Record<string, JsonValue>,
    attributes,
    slots,
    settings,
    events: [...new Set(['input', 'change', ...events])],
    ...(example.fixture && page.exampleModule ? { fixture: page.exampleModule } : {}),
  };
}

/** A docs composition reuses the same published example module as its component reference. */
export async function mountPublishedExample<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  name: string,
  container: HTMLElement,
  scope: Scope,
): Promise<MountedExample<HTMLElementTagNameMap[T]>> {
  const abort = new AbortController();
  scope.add(() => abort.abort(), 'source example request');
  const index = await loadIndex(abort.signal);
  const page = await loadComponent(index, tag, abort.signal);
  if (!page?.exampleModule) throw new Error(`No authored example module is available for ${tag}.`);
  const registration = page.enrichment?.['registration'];
  if (typeof registration !== 'string')
    throw new Error(`No public registration is available for ${tag}.`);
  await import(registration);
  const module = (await import(page.exampleModule)) as {
    default: ExampleSet<HTMLElementTagNameMap[T]>;
  };
  if (scope.disposed) throw new DOMException('The composition was closed.', 'AbortError');
  const mounted = await mountExample(module.default, name, container);
  if (scope.disposed) {
    mounted.dispose();
    throw new DOMException('The composition was closed.', 'AbortError');
  }
  scope.add(() => mounted.dispose(), 'published component example');
  return mounted;
}
