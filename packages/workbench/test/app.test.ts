import { readFileSync } from 'node:fs';
import { matchRoutes, type AnyRoute, type RouteContext } from '@oddkin/app/router';
import { isTemplateResult } from '@oddkin/core/template';
import { describe, expect, it } from 'vitest';
import { shellRoutes, type ShellView } from '../src/app/routes.js';
import { search, searchItems } from '../src/app/search.js';
import { inline } from '../src/app/views.js';
import { defineDocs, type WorkbenchConfig } from '../src/config/index.js';
import {
  buildPageRegistry,
  type CemPackage,
  type OddkinMetadataLike,
  type PageRegistry,
} from '../src/pages/index.js';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const cem = json('../../components/custom-elements.json') as CemPackage;
const metadata = json('../../components/oddkin.metadata.json') as OddkinMetadataLike;

function registry(
  config: Partial<WorkbenchConfig> = {},
  docs?: ReturnType<typeof defineDocs>,
): PageRegistry {
  const result = buildPageRegistry({
    config: { library: { packages: ['@oddkin/components'] }, ...config },
    cem,
    metadata,
    ...(docs ? { docs } : {}),
  });
  if (!result.registry) throw new Error(JSON.stringify(result.diagnostics));
  return result.registry;
}

const context = (path: string, search = '') =>
  ({
    params: {},
    search: undefined,
    location: { path, search, hash: '' },
    signal: new AbortController().signal,
  }) as unknown as RouteContext<unknown, unknown>;

/** The deepest matched route for a path, or undefined. */
function leaf(routes: readonly AnyRoute[], path: string): AnyRoute | undefined {
  return matchRoutes(routes, path)?.at(-1)?.route;
}

const redirectOf = (route: AnyRoute | undefined, path: string, search = '') =>
  typeof route?.redirect === 'function'
    ? route.redirect({ params: {}, location: { path, search, hash: '' } })
    : route?.redirect;

describe('shell routes from the page registry', () => {
  it('route every visible page to a level that loads that page', async () => {
    const reg = registry();
    const loads: string[] = [];
    const routes = shellRoutes(reg, (page) => (loads.push(page.id), { file: page.id }));
    const visible = reg.pages.filter((p) => p.visible);
    expect(visible.length).toBeGreaterThan(5);
    for (const page of visible) {
      const route = leaf(routes, page.route);
      expect(route?.name, page.route).toBe(page.id);
      expect(route?.title).toBe(page.title);
      const view = (await route!.load!(context(page.route))) as ShellView;
      expect(view).toEqual({ kind: 'page', page, data: { file: page.id } });
    }
    expect(loads).toEqual(visible.map((p) => p.id));
    // Trailing slashes and unknown paths.
    expect(leaf(routes, '/components/odd-button/')?.name).toBe('components/odd-button');
    expect(matchRoutes(routes, '/components/odd-nothing')).toBeUndefined();
    expect(matchRoutes(routes, '/foundations/typography')).toBeUndefined();
  });

  it('never routes hidden pages', () => {
    const routes = shellRoutes(
      registry({}, defineDocs({ pages: { 'components/odd-card': { visible: false } } })),
      () => undefined,
    );
    expect(matchRoutes(routes, '/components/odd-card')).toBeUndefined();
    expect(leaf(routes, '/components/odd-button')?.name).toBe('components/odd-button');
    const studio = shellRoutes(registry({ themeStudio: { enabled: false } }), () => undefined);
    expect(matchRoutes(studio, '/theme-studio')).toBeUndefined();
  });

  it('redirect legacy routes like resolveLegacyRoute, keeping valid share state', () => {
    const routes = shellRoutes(registry(), () => undefined);
    const playground = leaf(routes, '/playground');
    expect(redirectOf(playground, '/playground', '?component=odd-card&preset=loading')).toBe(
      '/components/odd-card?preset=loading',
    );
    expect(redirectOf(playground, '/playground', '')).toBe('/components');
    expect(redirectOf(playground, '/playground', '?component=odd-nothing')).toBe('/components');
    expect(redirectOf(leaf(routes, '/foundations/theme-studio'), '/foundations/theme-studio')).toBe(
      '/theme-studio',
    );
    // A configured Theme Studio route moves the target, not the legacy source.
    const moved = shellRoutes(registry({ themeStudio: { route: '/studio' } }), () => undefined);
    expect(leaf(moved, '/studio')?.name).toBe('theme-studio');
    expect(redirectOf(leaf(moved, '/foundations/theme-studio'), '/foundations/theme-studio')).toBe(
      '/studio',
    );
    // Without legacy redirects there is nothing at the old paths.
    const none = shellRoutes(registry({ navigation: { legacyRedirects: false } }), () => undefined);
    expect(matchRoutes(none, '/playground')).toBeUndefined();
  });

  it('show a notice where Products and modes would be when it is not enabled', async () => {
    const routes = shellRoutes(registry(), () => undefined);
    const notice = leaf(routes, '/foundations/products');
    expect(await notice!.load!(context('/foundations/products'))).toEqual({
      kind: 'notice',
      code: 'products.disabled',
    });
    const enabled = registry({
      products: {
        enabled: true,
        sources: [{ id: 'clinic', from: { theme: './t.ts', product: 'clinic' } }],
      },
    });
    const withProducts = shellRoutes(enabled, () => undefined);
    expect(leaf(withProducts, '/foundations/products')?.name).toBe('products');
  });

  it('send the base URL to the first primary destination unless there is a home page', async () => {
    const routes = shellRoutes(registry(), () => undefined);
    expect(redirectOf(leaf(routes, '/'), '/')).toBe('/foundations');
    const reordered = shellRoutes(
      registry({ navigation: { primary: ['components', 'foundations'] } }),
      () => undefined,
    );
    expect(redirectOf(leaf(reordered, '/'), '/')).toBe('/components');
    const home = shellRoutes(registry({ navigation: { home: true } }), (page) => page.id);
    const root = leaf(home, '/');
    expect(root?.name).toBe('home');
    expect(((await root!.load!(context('/'))) as ShellView & { data: unknown }).data).toBe('home');
  });
});

describe('search', () => {
  const items = searchItems(
    registry({}, defineDocs({ pages: { 'foundations/spacing': { tags: ['layout', 'gap'] } } })),
  );

  it('projects the registry: visible pages with their kinds', () => {
    expect(items.find((i) => i.id === 'components/odd-button')).toMatchObject({
      kind: 'component',
      title: 'Button',
      route: '/components/odd-button',
    });
    expect(items.find((i) => i.id === 'foundations/spacing')?.kind).toBe('foundation');
    const hidden = searchItems(
      registry({}, defineDocs({ pages: { 'components/odd-card': { visible: false } } })),
    );
    expect(hidden.some((i) => i.id === 'components/odd-card')).toBe(false);
  });

  it('ranks title matches over ids, tags, and summaries; every word must match', () => {
    expect(search(items, 'spac').results.map((i) => i.title)).toEqual(['Spacing']);
    expect(search(items, 'SIDE').results[0]?.title).toBe('Side nav');
    // A tag name matches through the id.
    expect(search(items, 'odd-inp').results.map((i) => i.title)).toEqual(['Input']);
    expect(search(items, 'gap').results.map((i) => i.title)).toEqual(['Spacing']);
    // A word only in a summary still matches.
    const actions = search(items, 'action');
    expect(actions.results.map((i) => i.title)).toContain('Button');
    // Titles containing the word rank above pages matched only through their id (tag name).
    const titled = search(items, 'o').results.map((i) => i.title.toLowerCase().includes('o'));
    expect(titled.indexOf(false)).toBeGreaterThan(titled.lastIndexOf(true));
    expect(search(items, 'side navigation').results.map((i) => i.title)).toEqual(['Side nav']);
    expect(search(items, 'side zebra').total).toBe(0);
    expect(search(items, '   ')).toEqual({ results: [], total: 0 });
  });

  it('caps the results and counts them all', () => {
    const all = search(items, 'o');
    expect(all.total).toBeGreaterThan(3);
    const capped = search(items, 'o', 2);
    expect(capped.results).toHaveLength(2);
    expect(capped.total).toBe(all.total);
    expect(capped.results).toEqual(all.results.slice(0, 2));
  });
});

describe('inline code spans', () => {
  it('renders `code` as code and keeps everything else as text', () => {
    const parts = inline('from `.items` or <b>slots</b>');
    expect(parts[0]).toBe('from ');
    expect(isTemplateResult(parts[1])).toBe(true);
    expect(parts[2]).toBe(' or <b>slots</b>');
    expect(inline('a `b')).toEqual(['a `b']);
    expect(inline('`x` and `y`').filter((p) => isTemplateResult(p))).toHaveLength(2);
  });
});
