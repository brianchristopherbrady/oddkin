import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { ComponentPageData } from '../packages/workbench/dist/data/index.js';
import {
  componentFacts,
  initialState,
  presets,
  snippet,
  type PreviewState,
} from '../packages/workbench/dist/panels/model.js';
import type { FrameSettings } from '../packages/workbench/dist/protocol/index.js';

// Every component the published @oddkin/components and @oddkin/ai metadata declare, on the
// Workbench dev server (port 4175; tests/fixtures/workbench-oddkin documents both packages). New
// components are covered without new tests.
const base = 'http://127.0.0.1:4175/';
const at = (path: string) => new URL(path, base).href;
const tags = ['components', 'ai'].flatMap((dir) =>
  Object.values(
    (
      JSON.parse(
        readFileSync(new URL(`../packages/${dir}/oddkin.metadata.json`, import.meta.url), 'utf8'),
      ) as { components: Record<string, { tag: string }> }
    ).components,
  ).map((component) => component.tag),
);
/** Modules of the documented packages, as the frames' import map serves them. */
const LIBRARY = /\/_oddkin\/m\/@oddkin\/(components|ai)@[^/]+\//;

const getJson = async <T>(path: string) => (await (await fetch(at(path))).json()) as T;

interface ImportMap {
  readonly imports?: Readonly<Record<string, string>>;
  readonly scopes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** Resolve a specifier as the browser does with this import map (exact, then longest prefix). */
function resolve(map: ImportMap, specifier: string, referrer: string): string | undefined {
  if (/^(\.{0,2}\/|[a-z][a-z0-9+.-]*:)/i.test(specifier)) return new URL(specifier, referrer).href;
  const lookup = (table: Readonly<Record<string, string>> | undefined) => {
    if (!table) return undefined;
    if (table[specifier]) return new URL(table[specifier], base).href;
    const prefix = Object.keys(table)
      .filter((key) => key.endsWith('/') && specifier.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    return prefix
      ? new URL(`${table[prefix]}${specifier.slice(prefix.length)}`, base).href
      : undefined;
  };
  const scopes = Object.keys(map.scopes ?? {})
    .filter((scope) => referrer.startsWith(new URL(scope, base).href))
    .sort((a, b) => b.length - a.length);
  for (const scope of scopes) {
    const hit = lookup(map.scopes?.[scope]);
    if (hit) return hit;
  }
  return lookup(map.imports);
}

const IMPORTS =
  /(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]*?\s*from\s*)?['"]([^'"\n]+)['"]|\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g;

/** The static and literal dynamic import graph of a module, over HTTP from the dev server. */
async function moduleGraph(map: ImportMap, entry: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const url = queue.pop() as string;
    if (seen.has(url)) continue;
    seen.add(url);
    const text = await (await fetch(url)).text();
    for (const match of text.matchAll(IMPORTS)) {
      const target = resolve(map, (match[1] ?? match[2]) as string, url);
      if (target) queue.push(target);
    }
  }
  return seen;
}

test.describe('Workbench over the whole catalog', () => {
  // Alone, each test takes at most 25 s in Firefox; four Firefox workers on a busy machine take far longer.
  test.describe.configure({ timeout: 120_000 });

  for (const tag of tags) {
    test(`<${tag}> previews in light and dark, loading only its own module graph`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const loaded = new Set<string>();
      page.on('request', (request) => {
        if (!LIBRARY.test(request.url())) return;
        try {
          if (request.frame() !== page.mainFrame()) loaded.add(request.url());
        } catch {
          // A request without a frame (a worker) is not a preview's.
        }
      });
      await page.goto(at(`components/${tag}`));
      await expect(page.locator('main h1')).toBeVisible();
      const frames = page.locator('oddkin-workbench-component iframe');
      const element = (i: number) =>
        page.frameLocator('oddkin-workbench-component iframe').nth(i).locator(tag);

      // Side by side straight away: two cold frame loads per component, not three.
      await page.getByLabel('Light and dark side by side').check();
      await expect(frames).toHaveCount(2);
      for (const [i, mode] of ['light', 'dark'].entries()) {
        // Each frame loads the library's module graph unbundled (slow in Firefox under load).
        await expect(element(i)).toBeAttached({ timeout: 45_000 });
        expect(
          await element(i).evaluate(
            (el, name) => ({
              upgraded: el instanceof el.ownerDocument.defaultView!.customElements.get(name)!,
              mode: el.ownerDocument.documentElement.dataset['oddMode'],
            }),
            tag,
          ),
        ).toEqual({ upgraded: true, mode });
      }
      await expect(page.locator('.wb-status[role="alert"]')).toHaveCount(0);

      // Only the component's registration entry and what it imports, from either package.
      const data = await getJson<ComponentPageData>(`_oddkin/pages/components/${tag}.json`);
      const map = await getJson<ImportMap>('_oddkin/frame.importmap.json');
      const entry = resolve(
        map,
        String(data.enrichment?.['registration']),
        at('_oddkin/frame.html'),
      );
      expect(entry, 'the registration entry resolves through the frame import map').toBeTruthy();
      const graph = await moduleGraph(map, entry as string);
      expect([...loaded]).toContain(entry);
      expect([...loaded].filter((url) => !graph.has(url))).toEqual([]);
      expect(errors).toEqual([]);
    });

    test(`<${tag}>: every generated snippet uses declared names and runs as written`, async ({
      page,
    }) => {
      const data = await getJson<ComponentPageData>(`_oddkin/pages/components/${tag}.json`);
      const facts = componentFacts(data);
      const attributes = new Set(facts.rows.flatMap((r) => (r.attribute ? [r.attribute] : [])));
      const properties = new Set(facts.rows.flatMap((r) => (r.property ? [r.property] : [])));
      const slots = new Set(facts.slots.map((s) => s.name));
      // The snippets the page offers: its first state and each correct preset.
      const states = new Map<string, PreviewState>();
      for (const state of [
        initialState(data),
        ...presets(data).flatMap((p) => (p.state && !p.incorrect ? [p.state] : [])),
      ])
        states.set(JSON.stringify(state), state);
      // A consumer page: the frames' import map and theme, then the snippet's markup verbatim.
      const frame = await (await fetch(at('_oddkin/frame.html'))).text();
      const head = (frame.match(/<head>([\s\S]*)<\/head>/)?.[1] ?? '').replace(
        /<script type="module">[\s\S]*?<\/script>/,
        '',
      );
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      const runs: { state: PreviewState; settings?: FrameSettings }[] = [...states.values()].map(
        (state) => ({ state }),
      );
      runs.push({ state: initialState(data), settings: { mode: 'dark', direction: 'rtl' } });
      let n = 0;
      for (const { state, settings } of runs) {
        for (const name of Object.keys(state.attributes))
          expect(attributes, `attribute ${name} is declared`).toContain(name);
        for (const name of Object.keys(state.properties))
          expect(properties, `property ${name} is declared`).toContain(name);
        for (const name of Object.keys(state.slots))
          expect(slots, `slot "${name}" is declared`).toContain(name);
        const code = snippet(data, state, settings ? { settings } : {});
        const url = at(`_snippet/${tag}/${n++}.html`);
        await page.route(url, (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html>\n<html lang="en"><head>${head}</head><body>\n${code}</body></html>\n`,
          }),
        );
        await page.goto(url);
        await page.waitForFunction((name) => customElements.get(name) !== undefined, tag);
        const result = await page.evaluate(
          ({ name, attributeNames, propertyNames }) => {
            const element = document.querySelector(name) as HTMLElement & Record<string, unknown>;
            return {
              upgraded: element instanceof customElements.get(name)!,
              scheme: getComputedStyle(element).colorScheme,
              direction: getComputedStyle(element).direction,
              attributes: Object.fromEntries(
                attributeNames.map((a) => [a, element.getAttribute(a)]),
              ),
              properties: Object.fromEntries(
                propertyNames.map((p) => [p, JSON.stringify(element[p])]),
              ),
            };
          },
          {
            name: tag,
            attributeNames: Object.keys(state.attributes),
            propertyNames: Object.keys(state.properties),
          },
        );
        expect(result.upgraded, code).toBe(true);
        // A copied preview scope applies as written: the page's own mode is light.
        expect([result.scheme, result.direction], code).toEqual(
          settings ? ['dark', 'rtl'] : ['light', 'ltr'],
        );
        expect(result.attributes, code).toEqual(state.attributes);
        expect(result.properties, code).toEqual(
          Object.fromEntries(
            Object.entries(state.properties).map(([p, v]) => [p, JSON.stringify(v)]),
          ),
        );
      }
      expect(problems).toEqual([]);
    });
  }
});
