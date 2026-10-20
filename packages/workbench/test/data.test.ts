import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defineDocs, type WorkbenchConfig } from '../src/config/index.js';
import {
  buildWorkbenchData,
  createImportMap,
  pageFile,
  resolveTarget,
  serializeData,
  type ComponentPageData,
  type FoundationPageData,
  type LibraryInput,
  type PackageManifest,
  type TokenInspectionLike,
} from '../src/data/index.js';
import type { CemPackage, OddkinMetadataLike } from '../src/pages/index.js';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

// The real published outputs of @oddkin/components and @oddkin/ai, and the default theme's
// token inspection that the components' foundations reference.
const components: LibraryInput = {
  name: '@oddkin/components',
  version: '0.0.0',
  cem: json('../../components/custom-elements.json') as CemPackage,
  metadata: json('../../components/oddkin.metadata.json') as OddkinMetadataLike,
};
const ai: LibraryInput = {
  name: '@oddkin/ai',
  version: '0.0.0',
  cem: json('../../ai/custom-elements.json') as CemPackage,
  metadata: json('../../ai/oddkin.metadata.json') as OddkinMetadataLike,
};
const inspection = json('../../tokens/dist/inspect/default.inspect.json') as TokenInspectionLike;
// An independent library with standard CEM only.
const acme: LibraryInput = {
  name: '@acme/ui',
  version: '1.4.0',
  cem: json('./fixtures/acme.custom-elements.json') as CemPackage,
};

const config: WorkbenchConfig = {
  library: { packages: ['@oddkin/components'] },
  branding: { name: 'Oddkin', links: [{ label: 'Source', href: 'https://example.test/oddkin' }] },
};

function build(input: Parameters<typeof buildWorkbenchData>[0]) {
  const { data, diagnostics } = buildWorkbenchData(input);
  if (!data) throw new Error(JSON.stringify(diagnostics));
  return { data, diagnostics };
}

describe('Workbench data from published outputs', () => {
  it('writes a small index and one data file per visible page', () => {
    const { data } = build({ config, libraries: [components], tokens: inspection });
    const { index } = data;
    expect(index.format).toBe('oddkin.workbench-index');
    expect(index.version).toBe(1);
    expect(index.branding).toEqual({
      name: 'Oddkin',
      links: [{ label: 'Source', href: 'https://example.test/oddkin' }],
    });
    expect(index.libraries).toEqual([
      { name: '@oddkin/components', version: '0.0.0', prefix: 'odd-' },
    ]);
    const visible = index.registry.pages.filter((p) => p.visible).map((p) => p.id);
    expect(Object.keys(index.pages)).toEqual(visible);
    expect(Object.keys(data.pages)).toEqual(visible);
    for (const id of visible) expect(index.pages[id]).toBe(pageFile(id));
    expect(index.pages['components/odd-button']).toBe('pages/components/odd-button.json');
    // The index carries no page detail: declarations stay in the page files.
    expect(serializeData(index)).not.toContain('"cssParts"');
  });

  it('gives a component page its CEM declaration, enrichment, and examples verbatim', () => {
    const { data } = build({ config, libraries: [components], tokens: inspection });
    const page = data.pages['components/odd-button'] as ComponentPageData;
    expect(page).toMatchObject({
      format: 'oddkin.workbench-page',
      version: 1,
      id: 'components/odd-button',
      kind: 'component',
      tag: 'odd-button',
      package: '@oddkin/components',
      module: 'dist/button/button.js',
    });
    expect(page.declaration['tagName']).toBe('odd-button');
    expect(page.declaration).toBe(
      (components.cem as CemPackage).modules
        .flatMap((m) => m.declarations ?? [])
        .find((d) => d.tagName === 'odd-button'),
    );
    expect(page.enrichment?.['registration']).toBe('@oddkin/components/define/button');
    const ids = page.examples.map((e) => e['id']);
    expect(ids).toContain('example:odd-button/default');
    expect(ids.every((id) => String(id).startsWith('example:odd-button/'))).toBe(true);
    expect(page.examples.find((e) => e['id'] === 'example:odd-button/default')).toMatchObject({
      component: 'component:odd-button',
      name: 'default',
    });
  });

  it('resolves a foundation’s tokens from the inspection, in the foundation’s order', () => {
    const { data, diagnostics } = build({ config, libraries: [components], tokens: inspection });
    const page = data.pages['foundations/spacing'] as FoundationPageData;
    expect(page.kind).toBe('foundation');
    const listed = (components.metadata?.foundations?.['foundation:spacing']?.tokens ?? []).map(
      (t) => t.replace(/^token:/, ''),
    );
    expect(listed.length).toBeGreaterThan(0);
    expect(page.tokens.map((t) => t.name)).toEqual(listed);
    const md = page.tokens.find((t) => t.name === 'space.md');
    expect(md).toEqual(inspection.tokens.find((t) => t.name === 'space.md'));
    expect(page.tokens.some((t) => 'missing' in t)).toBe(false);
    expect(page.foundation['id']).toBe('spacing');
    expect(diagnostics.filter((d) => d.code.startsWith('data.token'))).toEqual([]);
  });

  it('never guesses token values that the inspection lacks', () => {
    const partial: TokenInspectionLike = {
      tokens: inspection.tokens.filter((t) => t.name !== 'space.md'),
    };
    const { data, diagnostics } = build({ config, libraries: [components], tokens: partial });
    const page = data.pages['foundations/spacing'] as FoundationPageData;
    expect(page.tokens.find((t) => t.name === 'space.md')).toEqual({
      name: 'space.md',
      missing: true,
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'data.token.missing',
        path: '/pages/foundations/spacing/tokens/space.md',
      }),
    );

    // With no inspection at all, one diagnostic explains every unknown value.
    const none = build({ config, libraries: [components] });
    const spacing = none.data.pages['foundations/spacing'] as FoundationPageData;
    expect(spacing.tokens.every((t) => t.missing === true && Object.keys(t).length === 2)).toBe(
      true,
    );
    expect(none.diagnostics.filter((d) => d.code === 'data.tokens.missing')).toHaveLength(1);
    expect(none.diagnostics.filter((d) => d.code === 'data.token.missing')).toEqual([]);
  });

  it('documents several packages together; identical shared records merge silently', () => {
    const both = build({
      config: { ...config, library: { packages: ['@oddkin/components', '@oddkin/ai'] } },
      libraries: [components, ai],
      tokens: inspection,
    });
    const ids = Object.keys(both.data.pages);
    expect(ids).toContain('components/odd-button');
    expect(ids).toContain('components/odd-citation');
    const citation = both.data.pages['components/odd-citation'] as ComponentPageData;
    expect(citation.package).toBe('@oddkin/ai');
    // Both packages publish the same core contracts: no conflict is reported.
    expect(both.diagnostics.filter((d) => d.code === 'data.metadata.conflict')).toEqual([]);
    expect(both.data.index.libraries.map((l) => l.name)).toEqual([
      '@oddkin/components',
      '@oddkin/ai',
    ]);
  });

  it('keeps the first package’s record when two packages disagree, and says so', () => {
    const metadata = components.metadata as OddkinMetadataLike;
    const button = metadata.components?.['component:odd-button'];
    const fork: LibraryInput = {
      name: '@fork/ui',
      version: '1.0.0',
      metadata: {
        ...metadata,
        components: {
          'component:odd-button': { ...button, tag: 'odd-button', category: 'category:other' },
        },
      },
    };
    const { data, diagnostics } = build({ config, libraries: [components, fork] });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'data.metadata.conflict',
        path: '/components/component:odd-button',
      }),
    );
    const page = data.pages['components/odd-button'] as ComponentPageData;
    expect(page.enrichment?.['category']).toBe(button?.category);
  });

  it('accepts token ids with the `token:` prefix', () => {
    const enriched: LibraryInput = {
      ...acme,
      metadata: json('./fixtures/acme.oddkin.metadata.json') as OddkinMetadataLike,
    };
    const tokens: TokenInspectionLike = {
      tokens: [{ name: 'space.sm', cssVariable: '--acme-space-sm', value: '0.5rem' }],
    };
    const { data, diagnostics } = build({
      config: { library: { packages: ['@acme/ui'] } },
      libraries: [enriched],
      tokens,
    });
    const page = data.pages['foundations/spacing'] as FoundationPageData;
    expect(page.tokens).toEqual([
      { name: 'space.sm', cssVariable: '--acme-space-sm', value: '0.5rem' },
      { name: 'space.md', missing: true },
    ]);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'data.token.missing',
        path: '/pages/foundations/spacing/tokens/space.md',
      }),
    );
  });

  it('titles components without the prefix every package shares', () => {
    const one = build({ config, libraries: [components] }).data.index.registry;
    expect(one.pages.find((p) => p.id === 'components/odd-button')?.title).toBe('Button');
    // Different prefixes: titles come from class names instead.
    const other: LibraryInput = {
      ...acme,
      metadata: json('./fixtures/acme.oddkin.metadata.json') as OddkinMetadataLike,
    };
    const mixed = build({ config, libraries: [components, other] }).data.index.registry;
    expect(mixed.pages.find((p) => p.id === 'components/odd-button')?.title).toBe('Oddkin button');
  });

  it('takes a tag from the first manifest that declares it, as the registry does', () => {
    const copy: LibraryInput = {
      name: '@copy/ui',
      version: '1.0.0',
      cem: {
        modules: [
          {
            path: 'dist/copy.js',
            declarations: [
              { kind: 'class', name: 'CopyButton', customElement: true, tagName: 'odd-button' },
            ],
          },
        ],
      },
    };
    const { data } = build({ config, libraries: [components, copy] });
    const page = data.pages['components/odd-button'] as ComponentPageData;
    expect(page.package).toBe('@oddkin/components');
    expect(page.module).toBe('dist/button/button.js');
  });

  it('supports standard CEM alone: component pages without enrichment', () => {
    const { data, diagnostics } = build({
      config: { library: { packages: ['@acme/ui'] } },
      libraries: [acme],
    });
    const page = data.pages['components/acme-button'] as ComponentPageData;
    expect(page.enrichment).toBeUndefined();
    expect(page.examples).toEqual([]);
    expect(page.package).toBe('@acme/ui');
    expect(data.index.branding.name).toBe('@acme/ui');
    expect(data.index.libraries).toEqual([{ name: '@acme/ui', version: '1.4.0' }]);
    // No foundations without enrichment: the destination explains instead of showing pages.
    expect(Object.keys(data.pages).filter((id) => id.startsWith('foundations/'))).toEqual([]);
    expect(diagnostics.filter((d) => d.code === 'data.tokens.missing')).toEqual([]);
  });

  it('writes no data for hidden pages', () => {
    const docs = defineDocs({ pages: { 'components/odd-card': { visible: false } } });
    const { data } = build({ config, libraries: [components], tokens: inspection, docs });
    const card = data.index.registry.pages.find((p) => p.id === 'components/odd-card');
    expect(card?.visible).toBe(false);
    expect(data.pages['components/odd-card']).toBeUndefined();
    expect(data.index.pages['components/odd-card']).toBeUndefined();

    const noStudio = build({
      config: { ...config, themeStudio: { enabled: false } },
      libraries: [components],
    });
    expect(noStudio.data.index.pages['theme-studio']).toBeUndefined();
    expect(build({ config, libraries: [components] }).data.pages['theme-studio']).toEqual({
      format: 'oddkin.workbench-page',
      version: 1,
      id: 'theme-studio',
      kind: 'tool',
    });
  });

  it('returns no data for an invalid configuration', () => {
    const { data, diagnostics } = buildWorkbenchData({
      config: { library: { packages: [] } },
      libraries: [components],
    });
    expect(data).toBeUndefined();
    expect(diagnostics.map((d) => d.code)).toContain('config.library.missing');
  });

  it('is deterministic: the same inputs give the same bytes', () => {
    const a = build({ config, libraries: [components, ai], tokens: inspection });
    const b = build({ config, libraries: [components, ai], tokens: inspection });
    expect(serializeData(a.data.index)).toBe(serializeData(b.data.index));
    for (const id of Object.keys(a.data.pages))
      expect(serializeData(a.data.pages[id]!)).toBe(serializeData(b.data.pages[id]!));
    expect(serializeData(a.data.index).endsWith('}\n')).toBe(true);
  });

  it('names page files by their ids, one encoded segment each', () => {
    expect(pageFile('foundations')).toBe('pages/foundations.json');
    expect(pageFile('foundations/spacing')).toBe('pages/foundations/spacing.json');
    expect(pageFile('components/x-a b')).toBe('pages/components/x-a%20b.json');
  });
});

describe('import maps from package exports', () => {
  const base = '/docs/_oddkin/m/';
  const core: PackageManifest = json('../../core/package.json');
  const componentsPkg: PackageManifest = json('../../components/package.json');

  it('maps every subpath through the active conditions, development first', () => {
    const { importMap, diagnostics } = createImportMap([core], { base });
    expect(diagnostics).toEqual([]);
    expect(importMap.imports['@oddkin/core']).toBe('/docs/_oddkin/m/@oddkin/core/dist/index.js');
    expect(importMap.imports['@oddkin/core/element']).toBe(
      '/docs/_oddkin/m/@oddkin/core/dist/element/index.js',
    );
    // Without the development condition, the production build is used.
    const prod = createImportMap([core], { base, conditions: ['browser', 'import'] });
    expect(prod.importMap.imports['@oddkin/core']).toBe(
      '/docs/_oddkin/m/@oddkin/core/dist/prod/index.js',
    );
    // ./package.json is not a module.
    expect(importMap.imports['@oddkin/core/package.json']).toBeUndefined();
    expect(Object.keys(importMap.imports)).toEqual([...Object.keys(importMap.imports)].sort());
  });

  it('turns exact subpath patterns into prefix mappings', () => {
    const { importMap, diagnostics } = createImportMap([componentsPkg], { base });
    expect(diagnostics).toEqual([]);
    expect(importMap.imports['@oddkin/components/define/button']).toBe(
      '/docs/_oddkin/m/@oddkin/components/dist/button/button.define.js',
    );
    expect(importMap.imports['@oddkin/components/schemas/']).toBe(
      '/docs/_oddkin/m/@oddkin/components/schemas/',
    );
    // A types-only entry resolves to nothing for browsers.
    expect(importMap.imports['@oddkin/components/frameworks/react']).toBeUndefined();
  });

  it('follows Node’s rules for sugar, arrays, nested conditions, exclusions, and no exports', () => {
    const packages: PackageManifest[] = [
      { name: 'sugar', exports: './index.js' },
      { name: 'conditions', exports: { import: './esm.js', require: './cjs.cjs' } },
      {
        name: 'nested',
        exports: {
          '.': { node: './node.js', browser: { development: './dev.js', default: './prod.js' } },
          './fallback': [{ worker: './worker.js' }, './second.js'],
          './private/*': null,
          './order': { default: './default.js', development: './never.js' },
        },
      },
      { name: 'legacy', main: './main.js', module: './module.js' },
      { name: 'bare' },
    ];
    const { importMap, diagnostics } = createImportMap(packages, { base: '/m/' });
    expect(diagnostics).toEqual([]);
    expect(importMap.imports).toEqual({
      bare: undefined,
      'bare/': '/m/bare/',
      conditions: '/m/conditions/esm.js',
      legacy: '/m/legacy/module.js',
      'legacy/': '/m/legacy/',
      nested: '/m/nested/dev.js',
      'nested/fallback': '/m/nested/second.js',
      'nested/order': '/m/nested/default.js',
      sugar: '/m/sugar/index.js',
    });
    expect('bare' in importMap.imports).toBe(false);
  });

  it('resolves export targets like Node', () => {
    const active = new Set(['browser']);
    expect(resolveTarget('./a.js', active)).toBe('./a.js');
    expect(resolveTarget(null, active)).toBeNull();
    expect(resolveTarget({ node: './n.js' }, active)).toBeUndefined();
    expect(resolveTarget([{ node: './n.js' }, './b.js'], active)).toBe('./b.js');
    expect(resolveTarget({ browser: null, default: './d.js' }, active)).toBeNull();
    expect(resolveTarget({ types: './t.d.ts', default: './d.js' }, active)).toBe('./d.js');
  });

  it('diagnoses what an import map cannot express, and copies it does not load', () => {
    const { importMap, diagnostics } = createImportMap(
      [
        {
          name: 'p',
          version: '1.0.0',
          exports: {
            // Different suffixes, a prefix without "/", a target prefix without "/", no "*" in
            // the target (with a key contrived so that every other check passes).
            './a/*.js': './dist/a/*.mjs',
            './c*': './c/*',
            './d/*': './dist*',
            './e/*./x//': './x//',
            './b/*': './b/*',
          },
        },
        { name: 'p', version: '2.0.0', exports: './other.js' },
        { name: 'p', version: '1.0.0' },
        { name: 'q', exports: { '.': './q.js', import: './x.js' } },
        { name: 'r', exports: { '.': 'dist/r.js' } },
        { name: 's', exports: 5 },
      ],
      { base: '/m/' },
    );
    expect(diagnostics.map((d) => `${d.code} ${d.path}`)).toEqual([
      'data.importMap.pattern /p/exports/./a/*.js',
      'data.importMap.pattern /p/exports/./c*',
      'data.importMap.pattern /p/exports/./d/*',
      'data.importMap.pattern /p/exports/./e/*./x//',
      'data.importMap.duplicate /p',
      'data.importMap.exports /q/exports',
      'data.importMap.target /r/exports/.',
      'data.importMap.exports /s/exports',
    ]);
    expect(importMap.imports).toEqual({ 'p/b/': '/m/p/b/' });
    expect(() => createImportMap([], { base: '/m' })).toThrow(/must end with "\/"/);
  });
});
