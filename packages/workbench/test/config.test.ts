import { readdirSync, readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { defineDocs, defineWorkbenchConfig, resolveWorkbenchConfig } from '../src/config/index.js';

const schemas = new URL('../../../docs/schemas/', import.meta.url);
const json = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);
const validConfig = ajv.compile(json(new URL('workbench-config.v1.schema.json', schemas)));
const validDocs = ajv.compile(json(new URL('docs-content.v1.schema.json', schemas)));

describe('workbench config', () => {
  it('applies documented defaults', () => {
    const { config, diagnostics } = resolveWorkbenchConfig(
      defineWorkbenchConfig({ library: { packages: ['@acme/ui'] } }),
    );
    expect(diagnostics).toEqual([]);
    expect(config).toMatchObject({
      hosting: { basePath: '/', routing: 'history' },
      navigation: {
        home: false,
        primary: ['foundations', 'components', 'theme-studio'],
        legacyRedirects: true,
      },
      categories: { definitions: [], assign: {}, fallback: 'Other components' },
      themeStudio: { enabled: true, route: '/theme-studio' },
      products: {
        enabled: false,
        placement: ['foundations'],
        sources: [],
        discovery: { workspace: false },
      },
    });
  });

  it('agrees with the JSON Schema on its examples', () => {
    const dir = new URL('examples/', schemas);
    const files = readdirSync(dir).filter((f) => f.startsWith('workbench-config.'));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      const input = json(new URL(file, dir));
      const resolved = resolveWorkbenchConfig(input).config !== undefined;
      expect([file, resolved]).toEqual([file, validConfig(input)]);
    }
  });

  it('explains that there is no Playground destination', () => {
    const { config, diagnostics } = resolveWorkbenchConfig({
      library: { packages: ['x'] },
      playground: { enabled: true },
    });
    expect(config).toBeUndefined();
    expect(diagnostics[0]).toMatchObject({ code: 'config.key.unknown', path: '/playground' });
    expect(diagnostics[0]?.message).toContain('interactive examples live on each component page');
  });

  it('reports invalid values with paths', () => {
    const { diagnostics } = resolveWorkbenchConfig({
      library: { packages: ['x'] },
      hosting: { basePath: '/docs', routing: 'memory' },
      navigation: { primary: ['components', 'playground'] },
      categories: {
        definitions: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'Again' },
        ],
        assign: { 'x-y': 'b' },
      },
      themeStudio: { route: 'studio' },
      products: {
        placement: ['sidebar'],
        sources: [
          { id: 'p', from: { package: 'p' } },
          { id: 'p', from: { package: 'q' } },
        ],
      },
    });
    expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['config.basePath.invalid', '/hosting/basePath'],
      ['config.routing.invalid', '/hosting/routing'],
      ['config.navigation.unknown', '/navigation/primary/1'],
      ['config.category.duplicate', '/categories/definitions/1'],
      ['config.category.unknown', '/categories/assign/x-y'],
      ['config.route.invalid', '/themeStudio/route'],
      ['config.products.placement', '/products/placement/0'],
      ['config.product.duplicate', '/products/sources/1'],
    ]);
    expect(resolveWorkbenchConfig(null).diagnostics.map((d) => d.code)).toEqual(['config.invalid']);
  });

  it('defineDocs produces schema-valid authored content', () => {
    const docs = defineDocs({
      locale: 'en',
      pages: {
        'foundations/spacing': {
          summary: 'Spacing.',
          updated: '2026-10-01',
          sections: { scale: { guidance: 'Use the scale.' } },
        },
      },
    });
    expect(validDocs(docs), JSON.stringify(validDocs.errors)).toBe(true);
  });
});
