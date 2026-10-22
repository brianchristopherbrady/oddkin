/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settled } from '@oddkin/core/reactive';
import '../src/panels/component-define.js';
import {
  buildWorkbenchData,
  type ComponentPageData,
  type ExampleSetLike,
  type TokenInspectionLike,
} from '../src/data/index.js';
import { toExamplesJSON, type ExampleSet } from '../src/examples/index.js';
import type { CemPackage, OddkinMetadataLike } from '../src/pages/index.js';
import { pageCoverage, type CoverageItem } from '../src/panels/model.js';

// One check over every component the @oddkin/components and @oddkin/ai metadata publish: its
// detail page shows every item the coverage model lists, with content or a label, and nothing on
// the page is silently empty. New components are covered without new tests.

vi.setConfig({ testTimeout: 60_000 });

/** What every component page must show (owner's round-5 list): content or a label. */
const REQUIRED = [
  'api/properties',
  'api/slots',
  'api/parts',
  'api/css-properties',
  'api/events',
  'examples/examples',
  'interactive-example/presets',
  'interactive-example/preview',
  'tokens/style-mappings',
  'tokens/token-reads',
  'guidance/use-for',
  'guidance/not-for',
  'guidance/usage-pairs',
];

const json = async <T>(path: string) =>
  (await (await fetch(new URL(path, import.meta.url))).json()) as T;
const exampleSets = (modules: Record<string, ExampleSet<Element>>) =>
  Object.values(modules).map((set) => toExamplesJSON(set) as unknown as ExampleSetLike);

async function catalog() {
  const library = async (dir: string, name: string, sets: ExampleSetLike[]) => ({
    name,
    version: '0.0.0',
    cem: await json<CemPackage>(`../../${dir}/custom-elements.json`),
    metadata: await json<OddkinMetadataLike>(`../../${dir}/oddkin.metadata.json`),
    examples: sets,
  });
  const { data, diagnostics } = buildWorkbenchData({
    config: { library: { packages: ['@oddkin/components', '@oddkin/ai'] } },
    libraries: [
      await library(
        'components',
        '@oddkin/components',
        exampleSets(
          import.meta.glob<ExampleSet<Element>>('../../components/src/**/*.examples.ts', {
            eager: true,
            import: 'default',
          }),
        ),
      ),
      await library(
        'ai',
        '@oddkin/ai',
        exampleSets(
          import.meta.glob<ExampleSet<Element>>('../../ai/src/**/*.examples.ts', {
            eager: true,
            import: 'default',
          }),
        ),
      ),
    ],
    tokens: await json<TokenInspectionLike>('../../tokens/dist/inspect/default.inspect.json'),
  });
  if (!data) throw new Error(JSON.stringify(diagnostics));
  return { data, diagnostics };
}

const normalized = (node: Node | null | undefined) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Problems on one rendered page, as readable strings; empty when the page has no unlabelled gap. */
function gaps(root: ShadowRoot, coverage: readonly CoverageItem[], sections: string[]): string[] {
  const problems: string[] = [];
  const rendered = [...root.querySelectorAll('section')].map((s) => s.id);
  if (rendered.join() !== sections.join())
    problems.push(`sections ${rendered.join()} instead of ${sections.join()}`);
  for (const section of root.querySelectorAll('section')) {
    const heading = section.querySelector(':scope > h2');
    if (!normalized(heading)) problems.push(`#${section.id}: no heading`);
    const body = [...section.children].filter((child) => child !== heading);
    if (!body.some((child) => normalized(child))) problems.push(`#${section.id}: empty`);
  }
  const marked = [...root.querySelectorAll<HTMLElement>('[data-coverage]')];
  const ids = marked.map((element) => element.dataset['coverage']);
  if (ids.join() !== coverage.map((item) => item.id).join())
    problems.push(`items ${ids.join()} instead of ${coverage.map((item) => item.id).join()}`);
  for (const item of coverage) {
    const element = marked.find((e) => e.dataset['coverage'] === item.id);
    if (!element) continue;
    const where = `${item.id} (${item.state})`;
    if (element.closest('section')?.id !== item.section)
      problems.push(`${where}: outside its section`);
    if (element.dataset['state'] !== item.state)
      problems.push(`${where}: shown as ${element.dataset['state']}`);
    const text = normalized(element);
    const label = element.querySelector(':scope > .wb-not-documented, :scope > .wb-muted');
    if (item.state === 'missing') {
      const expected = `${item.subject ? `${item.subject}: not documented` : 'Not documented'}. Supplied by ${item.source}.`;
      if (normalized(label) !== expected) problems.push(`${where}: label "${normalized(label)}"`);
    } else if (item.state === 'none') {
      if (normalized(label) !== item.empty) problems.push(`${where}: label "${normalized(label)}"`);
    } else if (!text && !element.querySelector('.wb-preview')) {
      problems.push(`${where}: no content`);
    } else if (label && label.classList.contains('wb-not-documented')) {
      problems.push(`${where}: labelled although documented`);
    }
  }
  // Every table cell says something: a value, "Unknown", or "Not documented".
  for (const cell of root.querySelectorAll('[data-table] th, [data-table] td'))
    if (!normalized(cell) && !cell.querySelector('input, select, textarea, button'))
      problems.push(`empty cell in ${cell.closest('[data-table]')?.getAttribute('data-table')}`);
  return problems;
}

const mounted: HTMLElement[] = [];
afterEach(async () => {
  for (const element of mounted.splice(0)) element.remove();
  await settled();
});

describe('component detail coverage', () => {
  it('every @oddkin/components and @oddkin/ai page shows each item, with content or a label', async () => {
    const { data, diagnostics } = await catalog();
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const entries = data.index.registry.pages.filter((p) => p.kind === 'component');
    // Both packages are walked; the count only grows as components land.
    expect(entries.filter((p) => p.id.startsWith('components/odd-')).length).toBeGreaterThan(20);
    const failures: Record<string, string[]> = {};
    const labelled: Record<string, string[]> = {};
    for (const entry of entries) {
      const page = data.pages[entry.id] as ComponentPageData | undefined;
      if (!page) {
        failures[entry.id] = ['no page data'];
        continue;
      }
      const coverage = pageCoverage(page);
      const listed = coverage.map((item) => item.id);
      const problems = REQUIRED.filter((id) => !listed.includes(id)).map(
        (id) => `${id}: not covered`,
      );
      const hidden = entry.sections.filter((s) => !s.visible).map((s) => s.id);
      if (hidden.length) problems.push(`hidden sections: ${hidden.join(', ')}`);
      // No frame document: previews say so and load nothing; the catalog walk stays fast.
      const panel = document.createElement('oddkin-component-panel');
      panel.page = page;
      panel.index = data.index;
      mounted.push(panel);
      document.body.append(panel);
      await settled();
      problems.push(
        ...gaps(
          panel.shadowRoot!,
          coverage,
          entry.sections.filter((s) => s.visible).map((s) => s.id),
        ),
      );
      panel.remove();
      if (problems.length) failures[entry.id] = problems;
      const missing = coverage.flatMap((item) => [
        ...(item.state === 'missing' ? [item.id] : []),
        ...(item.undocumented ?? []).map((name) => `${item.id}#${name}`),
      ]);
      if (missing.length) labelled[entry.id] = missing;
    }
    // Component-side gaps are labelled on the page; listed here for the component owners.
    console.log(`Labelled component-side gaps: ${JSON.stringify(labelled, null, 1)}`);
    expect(failures).toEqual({});
  });
});
