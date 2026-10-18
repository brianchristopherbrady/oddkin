import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { defineDocs, type WorkbenchConfig } from '../src/config/index.js';
import {
  buildPageRegistry,
  cards,
  href,
  onThisPage,
  primaryNavigation,
  resolveLegacyRoute,
  searchEntries,
  sidebar,
  staticRedirects,
  type CemPackage,
  type OddkinMetadataLike,
  type PageRegistry,
} from '../src/pages/index.js';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);
const validRegistry = ajv.compile(json('../../../docs/schemas/page-registry.v1.schema.json'));
const validMetadata = ajv.compile(json('../../../docs/schemas/oddkin-metadata.v1.schema.json'));

// Real analyzer output for examples/core-counter, and an independent "Acme" library.
const counterCem = json(
  '../../analyzer/test/fixtures/core-counter.custom-elements.json',
) as CemPackage;
const counterMeta = json(
  '../../analyzer/test/fixtures/core-counter.oddkin.metadata.json',
) as OddkinMetadataLike;
const acmeCem = json('./fixtures/acme.custom-elements.json') as CemPackage;
const acmeMeta = json('./fixtures/acme.oddkin.metadata.json') as OddkinMetadataLike;

const acmeConfig: WorkbenchConfig = {
  library: { packages: ['@acme/ui'] },
  branding: { name: 'Acme UI' },
  hosting: { basePath: '/acme-ui/' },
  categories: { definitions: [{ id: 'actions', label: 'Actions', order: 1 }] },
  themeStudio: { themeConfig: './oddkin.theme.ts' },
  products: {
    enabled: true,
    placement: ['foundations', 'primary'],
    sources: [{ id: 'clinic', from: { theme: './oddkin.theme.ts', product: 'clinic' } }],
  },
};
const acmeDocs = defineDocs({
  aliases: { 'foundations/space': 'foundations/spacing' },
  pages: {
    'foundations/space': {
      summary: 'How Acme spaces things.',
      sections: { vocabulary: { visible: true } },
    },
    'components/acme-button': {
      updated: '2026-10-01',
      sections: { guidance: { guidance: 'Prefer one primary button per view.' }, nonsense: {} },
    },
    'foundations/elevation': { title: 'Shadows' },
  },
});

function build(input: Parameters<typeof buildPageRegistry>[0]) {
  const { registry, diagnostics } = buildPageRegistry(input);
  if (!registry) throw new Error(JSON.stringify(diagnostics));
  return { registry, diagnostics };
}
const page = (registry: PageRegistry, id: string) => {
  const found = registry.pages.find((p) => p.id === id);
  if (!found) throw new Error(`no page ${id}`);
  return found;
};

describe('page registry from fixture metadata', () => {
  it('core-counter analyzer output: components from CEM + enrichment, honest foundations', () => {
    const { registry, diagnostics } = build({
      config: { library: { packages: ['core-counter'] } },
      cem: counterCem,
      metadata: counterMeta,
    });
    expect(validRegistry(registry), JSON.stringify(validRegistry.errors)).toBe(true);
    expect(diagnostics).toEqual([]);
    expect(registry.pages.map((p) => p.id)).toEqual([
      'foundations',
      'components',
      'components/demo-counter',
      'components/demo-greeting',
      'theme-studio',
    ]);
    const counter = page(registry, 'components/demo-counter');
    expect(counter).toMatchObject({
      route: '/components/demo-counter',
      title: 'Demo counter',
      summary: 'A counter with local state.',
      group: 'Other components',
      eyebrow: 'Components · Other components',
      availability: 'full',
      visible: true,
    });
    expect(counter.updated).toBeUndefined();
    // No foundation data: the destination stays and explains, with no invented pages.
    expect(page(registry, 'foundations')).toMatchObject({
      visible: true,
      availability: 'unavailable',
    });
    expect(page(registry, 'theme-studio')).toMatchObject({
      availability: 'partial',
      nav: { card: false, sidebar: false },
    });
    expect(registry.primaryNav).toEqual(['foundations', 'components', 'theme-studio']);
  });

  it('acme: foundations, categories, examples, products, dates, and authored content', () => {
    const { registry, diagnostics } = build({
      config: acmeConfig,
      cem: acmeCem,
      metadata: acmeMeta,
      docs: acmeDocs,
    });
    expect(validMetadata(acmeMeta), JSON.stringify(validMetadata.errors)).toBe(true);
    expect(validRegistry(registry), JSON.stringify(validRegistry.errors)).toBe(true);
    expect(registry.basePath).toBe('/acme-ui/');

    const spacing = page(registry, 'foundations/spacing');
    expect(spacing).toMatchObject({
      title: 'Spacing',
      summary: 'How Acme spaces things.',
      availability: 'partial',
      updated: '2026-09-30',
      tags: ['tokens', 'layout'],
    });
    // Authored visible: true cannot show a section whose data is missing.
    expect(spacing.sections.map((s) => [s.id, s.visible])).toEqual([
      ['scale', true],
      ['vocabulary', false],
      ['precedence', true],
    ]);
    expect(page(registry, 'foundations/color')).toMatchObject({ availability: 'full' });
    expect(page(registry, 'foundations/color').updated).toBeUndefined();
    // A declared foundation with no available section is hidden.
    expect(page(registry, 'foundations/motion')).toMatchObject({
      visible: false,
      availability: 'unavailable',
      nav: { card: false },
    });

    const button = page(registry, 'components/acme-button');
    expect(button).toMatchObject({
      title: 'Button',
      group: 'Actions',
      updated: '2026-10-01',
      summary: 'Triggers an action.',
    });
    expect(Object.fromEntries(button.sections.map((s) => [s.id, s.visible]))).toEqual({
      overview: true,
      'interactive-example': true,
      api: true,
      examples: true,
      tokens: true,
      'behavior-and-accessibility': true,
      guidance: true,
      source: true,
      'known-limitations': true,
    });
    expect(page(registry, 'components/acme-card')).toMatchObject({
      group: 'Layout',
      summary: 'A surface for grouped content.',
    });
    // Not enriched: standard-CEM baseline, fallback group.
    expect(page(registry, 'components/acme-side-nav')).toMatchObject({
      availability: 'partial',
      group: 'Other components',
      title: 'Side nav',
    });
    expect(registry.pages.filter((p) => p.kind === 'component').map((p) => p.group)).toEqual([
      'Actions',
      'Layout',
      'Other components',
    ]);

    expect(page(registry, 'products')).toMatchObject({
      route: '/products',
      visible: true,
      nav: { primary: true, card: true, sidebar: true },
      legacyRoutes: ['/foundations/products'],
    });
    expect(registry.primaryNav).toEqual(['foundations', 'components', 'theme-studio', 'products']);
    expect(page(registry, 'theme-studio').availability).toBe('full');

    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'content.page.unknown',
      'content.section.unknown',
    ]);
  });

  it('a standard-CEM-only library gets the baseline with missing enrichment shown as such', () => {
    const { registry } = build({ config: { library: { packages: ['@acme/ui'] } }, cem: acmeCem });
    expect(validRegistry(registry)).toBe(true);
    const components = registry.pages.filter((p) => p.kind === 'component');
    expect(
      components.every((p) => p.availability === 'partial' && p.group === 'Other components'),
    ).toBe(true);
    expect(
      page(registry, 'components/acme-button').sections.find((s) => s.id === 'examples')?.visible,
    ).toBe(false);
    expect(registry.pages.some((p) => p.kind === 'foundation')).toBe(false);
  });

  it('different library configurations produce different content from the same code', () => {
    const counter = build({
      config: { library: { packages: ['core-counter'] } },
      cem: counterCem,
      metadata: counterMeta,
    }).registry;
    const acme = build({ config: acmeConfig, cem: acmeCem, metadata: acmeMeta }).registry;
    expect(counter.pages.map((p) => p.id)).not.toEqual(acme.pages.map((p) => p.id));
    expect(JSON.stringify(counter)).not.toContain('acme');
    expect(JSON.stringify(acme)).not.toContain('demo-');
  });

  it('is deterministic and never uses the build time as a date', () => {
    const input = { config: acmeConfig, cem: acmeCem, metadata: acmeMeta, docs: acmeDocs };
    const first = JSON.stringify(build(input).registry);
    expect(JSON.stringify(build(input).registry)).toBe(first);
    const dates = [...first.matchAll(/"updated":"([^"]+)"/g)].map((m) => m[1]);
    expect(dates.sort()).toEqual(['2026-09-30', '2026-10-01']);
  });

  it('keeps ids stable when routes and the base path change', () => {
    const moved = build({
      config: { ...acmeConfig, hosting: { basePath: '/v2/' }, themeStudio: { route: '/studio' } },
      cem: acmeCem,
      metadata: acmeMeta,
    }).registry;
    expect(page(moved, 'theme-studio')).toMatchObject({
      route: '/studio',
      legacyRoutes: ['/foundations/theme-studio'],
    });
    expect(moved.pages.map((p) => p.id)).toEqual(
      build({ config: acmeConfig, cem: acmeCem, metadata: acmeMeta }).registry.pages.map(
        (p) => p.id,
      ),
    );
  });

  it('Products and modes is absent by default, and hidden when enabled without products', () => {
    const plain = build({
      config: { library: { packages: ['@acme/ui'] } },
      cem: acmeCem,
      metadata: acmeMeta,
    }).registry;
    expect(plain.pages.some((p) => p.id === 'products')).toBe(false);
    expect(JSON.stringify(plain)).not.toContain('/products');
    const empty = buildPageRegistry({
      config: { library: { packages: ['@acme/ui'] }, products: { enabled: true } },
      cem: acmeCem,
    });
    expect(empty.registry?.pages.find((p) => p.id === 'products')?.visible).toBe(false);
    expect(empty.diagnostics.map((d) => d.code)).toEqual(['pages.products.empty']);
  });

  it('an invalid configuration yields diagnostics and no registry', () => {
    const { registry, diagnostics } = buildPageRegistry({
      config: { library: { packages: [] }, hosting: { basePath: 'docs' } } as WorkbenchConfig,
    });
    expect(registry).toBeUndefined();
    expect(diagnostics.map((d) => d.code)).toEqual([
      'config.library.missing',
      'config.basePath.invalid',
    ]);
  });
});

describe('registry projections', () => {
  const { registry } = build({
    config: acmeConfig,
    cem: acmeCem,
    metadata: acmeMeta,
    docs: acmeDocs,
  });

  it('primary navigation, sidebars, cards, and search come from the same entries', () => {
    expect(primaryNavigation(registry).map((p) => p.title)).toEqual([
      'Foundations',
      'Components',
      'Theme Studio',
      'Products and modes',
    ]);
    expect(cards(registry, 'foundations').map((p) => p.title)).toEqual([
      'Color',
      'Spacing',
      'Products and modes',
    ]);
    expect(cards(registry, 'theme-studio')).toEqual([]);
    expect(
      sidebar(registry, 'components').map((g) => [g.group, g.pages.map((p) => p.title)]),
    ).toEqual([
      ['Actions', ['Button']],
      ['Layout', ['Card']],
      ['Other components', ['Side nav']],
    ]);
    const search = searchEntries(registry).map((e) => e.id);
    expect(search).toContain('theme-studio');
    expect(search).not.toContain('foundations/motion');
  });

  it('"On this page" needs at least two visible sections', () => {
    expect(onThisPage(page(registry, 'foundations/spacing')).map((s) => s.id)).toEqual([
      'scale',
      'precedence',
    ]);
    expect(onThisPage(page(registry, 'theme-studio'))).toEqual([]);
  });

  it('builds hrefs under the base path in history and hash modes', () => {
    expect(href(registry, '/components/acme-button')).toBe('/acme-ui/components/acme-button');
    expect(href({ ...registry, routing: 'hash' }, '/components/acme-button')).toBe(
      '/acme-ui/#/components/acme-button',
    );
  });

  it('resolves legacy routes, preserving share state', () => {
    expect(resolveLegacyRoute(registry, '/playground')).toEqual({
      kind: 'redirect',
      to: '/components',
    });
    expect(resolveLegacyRoute(registry, '/playground', '?component=acme-button&mode=dark')).toEqual(
      {
        kind: 'redirect',
        to: '/components/acme-button?mode=dark',
      },
    );
    expect(resolveLegacyRoute(registry, '/playground', '?component=missing')).toEqual({
      kind: 'redirect',
      to: '/components',
    });
    expect(resolveLegacyRoute(registry, '/foundations/theme-studio')).toEqual({
      kind: 'redirect',
      to: '/theme-studio',
    });
    expect(resolveLegacyRoute(registry, '/foundations/products')).toEqual({
      kind: 'redirect',
      to: '/products',
    });
    const plain = build({ config: { library: { packages: ['x'] } }, cem: acmeCem }).registry;
    expect(resolveLegacyRoute(plain, '/foundations/products')).toEqual({
      kind: 'notice',
      code: 'products.disabled',
    });
    expect(resolveLegacyRoute(plain, '/nowhere')).toBeUndefined();
    expect(staticRedirects(registry)).toEqual([
      { from: '/playground', to: '/components' },
      { from: '/foundations/theme-studio', to: '/theme-studio' },
      { from: '/foundations/products', to: '/products' },
    ]);
    const noLegacy = build({
      config: { ...acmeConfig, navigation: { legacyRedirects: false } },
      cem: acmeCem,
    }).registry;
    expect(staticRedirects(noLegacy)).toEqual([]);
  });
});
