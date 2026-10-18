import { Ajv2020 } from 'ajv/dist/2020.js';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { analyze } from '../src/index.js';

// Definitions recomposed from another package's published definitions (multi-product.md §5,
// §10): the analyzer reads that package's custom-elements.json and oddkin.metadata.json and
// never executes its modules or the product's.

// Each analysis builds a TypeScript program (~1 s); allow for parallel test load.
vi.setConfig({ testTimeout: 30_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const json = async (relative: string) =>
  JSON.parse(await readFile(new URL(relative, repo), 'utf8')) as unknown;

const validateCem = new Ajv({ allErrors: true, strict: false }).compile(
  (await json('node_modules/custom-elements-manifest/schema.json')) as object,
);
const oddkinAjv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(oddkinAjv);
const validateOddkin = oddkinAjv.compile(
  (await json('docs/schemas/oddkin-metadata.v1.schema.json')) as object,
);

type Declaration = Record<string, unknown> & {
  name: string;
  members: Array<Record<string, unknown>>;
};
const declarations = (manifest: unknown) =>
  (manifest as { modules: Array<{ declarations?: Declaration[] }> }).modules.flatMap(
    (m) => m.declarations ?? [],
  );
const declaration = (manifest: unknown, name: string) =>
  declarations(manifest).find((d) => d.name === name) as Declaration;
const names = (d: Declaration, key: string) =>
  (d[key] as Array<{ name: string }>).map((x) => x.name);

interface Entry {
  definition?: Record<string, unknown> & { styles?: Array<Record<string, string>> };
  tokenReads?: Array<{ token: string }>;
}
const entry = (metadata: unknown, tag: string) =>
  (metadata as { components: Record<string, Entry> }).components[`component:${tag}`];
const tokens = (e: Entry | undefined) => (e?.tokenReads ?? []).map((t) => t.token).sort();

// The contract a class documents, without where each member was declared.
const contract = (d: Declaration) => {
  const strip = (list: unknown) =>
    ((list ?? []) as Array<Record<string, unknown>>)
      .map(({ inheritedFrom: _, ...rest }) => rest)
      .sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
  return {
    members: strip(d.members),
    attributes: strip(d['attributes']),
    events: strip(d['events']),
    slots: d['slots'],
    cssParts: d['cssParts'],
    cssStates: d['cssStates'],
  };
};

const foundationCem = await json('packages/components/custom-elements.json');
const foundation = (await json('packages/components/oddkin.metadata.json')) as {
  components: Record<string, Entry>;
  templates: Record<string, unknown>;
  styles: Record<string, { tokens?: string[] }>;
};
const button = declarations(foundationCem).find((d) => d['tagName'] === 'odd-button')!;

describe('a product package deriving from @oddkin/components', () => {
  const product = analyze({ project: path('tests/fixtures/analyzer-product/tsconfig.json') });

  it('emits valid outputs; only a recomposition that reuses the published class is reported', () => {
    expect(validateCem(product.manifest), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(product.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(product.diagnostics.map((d) => [d.code, d.source?.file, d.source?.line])).toEqual([
      ['analyzer.dynamic.definition', 'src/button/variants.ts', 29],
    ]);
    expect(Object.keys((product.metadata as { components: object }).components).sort()).toEqual([
      'component:studio-button',
      'component:studio-icon-button',
      'component:studio-quiet-button',
    ]);
  });

  it('gives derived definitions their own ids, extends links, and layered style sources', () => {
    expect(entry(product.metadata, 'studio-button')?.definition).toEqual({
      ref: { module: 'dist/button/button.definition.js', name: 'studioButtonDefinition' },
      extends: 'component:odd-button',
      template: {
        package: '@oddkin/components',
        module: 'dist/button/button.template.js',
        name: 'buttonTemplate',
      },
      styles: [
        {
          package: '@oddkin/components',
          module: 'dist/button/button.structural.styles.js',
          name: 'buttonStructuralStyles',
        },
        { module: 'dist/button/button.styles.js', name: 'studioButtonStyles' },
      ],
    });
    // Without styles of its own, a derived definition lists the foundation's style sources.
    expect(entry(product.metadata, 'studio-quiet-button')?.definition?.styles).toEqual(
      foundation.components['component:odd-button']?.definition?.styles?.map((s) => ({
        package: '@oddkin/components',
        ...s,
      })),
    );
  });

  it('documents the same contract as the published foundation, inherited by package', () => {
    const studio = declaration(product.manifest, 'StudioButton');
    const quiet = declaration(product.manifest, 'StudioQuietButton');
    for (const derived of [studio, quiet]) {
      expect(contract(derived)).toEqual(contract(button));
      expect(derived['superclass']).toEqual({
        name: 'OddkinButton',
        package: '@oddkin/components',
      });
      for (const member of derived.members.filter((m) => m['attribute']))
        expect(member['inheritedFrom']).toEqual({
          name: 'OddkinButton',
          package: '@oddkin/components',
          module: 'dist/button/button.js',
        });
    }
    expect(names(quiet, 'cssProperties')).toEqual(names(button, 'cssProperties'));
    expect(names(studio, 'cssProperties')).toEqual([
      ...names(button, 'cssProperties'),
      '--studio-button-radius',
    ]);
    // A replaced template provides its own slots and parts.
    const icon = declaration(product.manifest, 'StudioIconButton');
    expect([names(icon, 'slots'), names(icon, 'cssParts')]).toEqual([[''], ['control', 'icon']]);
  });

  it('reads tokens only through the styles each definition uses', () => {
    expect(tokens(entry(product.metadata, 'studio-quiet-button'))).toEqual(
      tokens(foundation.components['component:odd-button']),
    );
    expect(tokens(entry(product.metadata, 'studio-button'))).toEqual(['color.action.default']);
    expect(tokens(entry(product.metadata, 'studio-icon-button'))).toEqual([]);
  });

  it('relies on the anatomy and style reads the foundation publishes', () => {
    expect(foundation.templates['dist/button/button.template.js#buttonTemplate']).toEqual({
      module: 'dist/button/button.template.js',
      name: 'buttonTemplate',
      slots: ['', 'end', 'start'],
      parts: ['control', 'spinner'],
    });
    expect(foundation.styles['dist/styles/focus-ring.styles.js#focusRingStyles']?.tokens).toEqual([
      'color.focus.ring',
      'focus.offset',
      'focus.width',
    ]);
  });
});

describe('a package that publishes no facts', () => {
  const legacy = analyze({ project: path('tests/fixtures/analyzer-legacy/tsconfig.json') });

  it('is reported instead of guessed', () => {
    expect(validateCem(legacy.manifest), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(legacy.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(legacy.diagnostics.map((d) => [d.code, d.severity, d.source?.line])).toEqual([
      ['analyzer.published.sources', 'info', 6],
      ['analyzer.published.missing', 'warning', 9],
    ]);
    // The undocumented base class leaves its subclass undocumented.
    expect(declarations(legacy.manifest).map((d) => d.name)).toEqual(['AcmeLegacyButton']);
    const derived = declaration(legacy.manifest, 'AcmeLegacyButton');
    expect(derived['slots']).toEqual([{ name: '', description: 'The label.' }]);
    expect(derived['cssProperties']).toEqual([{ name: '--acme-ink', description: '' }]);
    // What the legacy styles read cannot be told apart, so it is kept.
    expect(tokens(entry(legacy.metadata, 'acme-legacy-button'))).toEqual(['color.text.primary']);
  });
});
