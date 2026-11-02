import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generate, layerOf, mergeThemes, type ThemeLayer } from '../src/index.js';
import { run } from '../src/node/cli.js';
import { loadConfig } from '../src/node/index.js';

// A theme file that builds on a shared base file (theming-and-styling.md §1.1; P1.1).
const dir = join(process.cwd(), '.tmp', `extends-${process.pid}`);
const at = (file: string) => join(dir, file);
const write = async (file: string, value: unknown) => {
  await mkdir(dirname(at(file)), { recursive: true });
  await writeFile(
    at(file),
    typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`,
  );
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

async function cli(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const ORG = {
  $schema: './schema.json',
  brand: { primary: '#5b46e8', neutral: '#78716c' },
  status: { danger: '#dc2626', info: '#2563eb' },
  spacing: { strategy: 'multiples', unit: '0.25rem', steps: { xs: 1, sm: 2, md: 3, lg: 4.5 } },
  density: { compact: { scale: 0.75 } },
  conditions: { 'page.wide': { media: { minWidth: '64rem' } } },
  profiles: {
    'navigation.compact': {
      'navigation.item.padding.inline': '{space.sm}',
      'layout.gap': '{space.xs}',
    },
  },
  overrides: {
    'color.surface.default': { light: '#fbfaff', dark: '{ref.neutral.900}' },
    'color.link': '{color.action.default}',
  },
} as const;

describe('mergeThemes', () => {
  it('merges named entries key by key and replaces everything else whole', () => {
    const base = deepFreeze(structuredClone(ORG));
    const layer = deepFreeze({
      $schema: './product.schema.json',
      extends: './org.theme.json',
      name: 'checkout',
      brand: { primary: '#0f766e' },
      status: { warning: '#d97706' },
      spacing: { strategy: 'explicit', steps: { sm: '0.5rem', md: '1rem' } },
      modes: ['light'],
      density: { spacious: { scale: 1.25 } },
      profiles: { 'navigation.compact': { 'layout.gap': '{space.sm}' } },
      overrides: { 'color.surface.default': '#ffffff' },
      products: { kiosk: { brand: { primary: '#e11d48' } } },
    });
    expect(mergeThemes(base, layer)).toEqual({
      $schema: './product.schema.json',
      name: 'checkout',
      brand: { primary: '#0f766e', neutral: '#78716c' },
      status: { danger: '#dc2626', info: '#2563eb', warning: '#d97706' },
      spacing: { strategy: 'explicit', steps: { sm: '0.5rem', md: '1rem' } },
      modes: ['light'],
      density: { compact: { scale: 0.75 }, spacious: { scale: 1.25 } },
      conditions: { 'page.wide': { media: { minWidth: '64rem' } } },
      profiles: {
        'navigation.compact': {
          'navigation.item.padding.inline': '{space.sm}',
          'layout.gap': '{space.sm}',
        },
      },
      // An entry's value is replaced whole: no light/dark pair survives under a string.
      overrides: { 'color.surface.default': '#ffffff', 'color.link': '{color.action.default}' },
      products: { kiosk: { brand: { primary: '#e11d48' } } },
    });
  });

  it('merges products one level deeper, and null removes an entry of a named map', () => {
    const base = deepFreeze({
      ...structuredClone(ORG),
      products: {
        clinic: { brand: { primary: '#0f766e' }, overrides: { 'color.link': '{ref.brand.700}' } },
        retired: { brand: { primary: '#7c2d12' } },
      },
    });
    const merged = mergeThemes(base, {
      brand: { neutral: null },
      status: { info: null },
      overrides: { 'color.link': null },
      products: {
        retired: null,
        clinic: { brand: { neutral: '#57534e' }, overrides: { 'color.action.default': '#0f766e' } },
      },
      density: { compact: null },
      conditions: { 'page.wide': null },
      profiles: { 'navigation.compact': { 'layout.gap': null } },
    });
    expect(merged).toMatchObject({
      brand: { primary: '#5b46e8' },
      status: { danger: '#dc2626' },
      overrides: { 'color.surface.default': { light: '#fbfaff', dark: '{ref.neutral.900}' } },
      products: {
        clinic: {
          brand: { primary: '#0f766e', neutral: '#57534e' },
          overrides: { 'color.link': '{ref.brand.700}', 'color.action.default': '#0f766e' },
        },
      },
      density: {},
      conditions: {},
      profiles: { 'navigation.compact': { 'navigation.item.padding.inline': '{space.sm}' } },
    });
    expect(Object.keys(merged['brand'] as object)).toEqual(['primary']);
    expect(Object.keys(merged['overrides'] as object)).toEqual(['color.surface.default']);
    expect(Object.keys(merged['products'] as object)).toEqual(['clinic']);
    // Outside a named map, null is a value: the generator reports it.
    const spacing = mergeThemes(base, { spacing: null });
    expect(spacing['spacing']).toBeNull();
    expect(generate(spacing).ok).toBe(false);
  });

  it('keeps the base’s extends and the layer’s $schema, and a __proto__ key as data', () => {
    const merged = mergeThemes(
      { extends: '../org.theme.json', $schema: './base.json', brand: { primary: '#5b46e8' } },
      JSON.parse('{ "extends": "./base.json", "overrides": { "__proto__": { "polluted": 1 } } }'),
    );
    expect(merged['extends']).toBe('../org.theme.json');
    expect(merged).not.toHaveProperty('$schema');
    expect(Object.keys(merged['overrides'] as object)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(generate(merged).diagnostics.map((d) => d.code)).toEqual(['config.extends.unresolved']);
  });
});

describe('layerOf', () => {
  const layers: ThemeLayer[] = [
    { file: 'org.json', config: ORG },
    {
      file: 'product.json',
      config: {
        extends: './org.json',
        brand: { primary: '#0f766e' },
        spacing: { strategy: 'explicit', steps: { md: '1rem' } },
        overrides: { 'color.link': '{ref.brand.700}' },
      },
    },
  ];
  const owner = (path: string) => layerOf(layers, path)?.file;

  it('names the file that set a merged entry or a value replaced whole', () => {
    expect(owner('/brand/primary')).toBe('product.json');
    expect(owner('/brand/neutral')).toBe('org.json');
    expect(owner('/overrides/color.link')).toBe('product.json');
    expect(owner('/overrides/color.surface.default')).toBe('org.json');
    expect(owner('/profiles/navigation.compact/layout.gap')).toBe('org.json');
    // The product replaced spacing whole, so even a step only the base has is the product's.
    expect(owner('/spacing/steps/xs')).toBe('product.json');
    expect(owner('/density/compact/scale')).toBe('org.json');
  });

  it('names no file for a generated token or the whole theme', () => {
    expect(owner('/tokens/color.text.primary')).toBeUndefined();
    expect(owner('')).toBeUndefined();
  });

  it('names the file that removed a value with null, and the file of a product role', () => {
    const removing: ThemeLayer[] = [
      {
        file: 'org.json',
        config: {
          brand: { primary: '#5b46e8' },
          overrides: { 'color.link': '{ref.brand.600}' },
          products: {
            clinic: { overrides: { 'color.link': '#0f766e' } },
            retired: { brand: { primary: '#7c2d12' } },
          },
        },
      },
      {
        file: 'product.json',
        config: {
          extends: './org.json',
          overrides: { 'color.link': null },
          products: {
            retired: null,
            clinic: { overrides: { 'color.action.default': '#0f766e' } },
          },
        },
      },
    ];
    const file = (path: string) => layerOf(removing, path)?.file;
    expect(file('/overrides/color.link')).toBe('product.json');
    expect(file('/products/retired')).toBe('product.json');
    expect(file('/products/clinic/overrides/color.link')).toBe('org.json');
    expect(file('/products/clinic/overrides/color.action.default')).toBe('product.json');
  });
});

beforeAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await write('org/org.theme.json', ORG);
  await write('brand/base.theme.json', {
    extends: '../org/org.theme.json',
    overrides: { 'color.link': null },
  });
  await write('apps/checkout/checkout.theme.json', {
    $schema: '../../schema.json',
    extends: '../../brand/base.theme.json',
    name: 'checkout',
    brand: { primary: '#0f766e' },
  });
  await write('node_modules/@acme/brand/package.json', {
    name: '@acme/brand',
    version: '1.0.0',
    exports: { './base.theme.json': './base.theme.json' },
  });
  await write('node_modules/@acme/brand/base.theme.json', ORG);
  await write('apps/kiosk/kiosk.theme.json', {
    extends: '@acme/brand/base.theme.json',
    name: 'kiosk',
    products: { lobby: { overrides: { 'color.action.default': '{ref.brand.700}' } } },
  });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadConfig with extends', { timeout: 30_000 }, () => {
  it('follows relative bases to the root and merges them in order', async () => {
    const loaded = await loadConfig(at('apps/checkout/checkout.theme.json'));
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.layers.map((layer) => relative(dir, layer.file).replace(/\\/g, '/'))).toEqual([
      'org/org.theme.json',
      'brand/base.theme.json',
      'apps/checkout/checkout.theme.json',
    ]);
    const [org, brand, checkout] = loaded.layers.map((layer) => layer.config as object);
    // Each layer is its file as written, so a tool saves the edited file and nothing merged.
    expect(checkout).toEqual({
      $schema: '../../schema.json',
      extends: '../../brand/base.theme.json',
      name: 'checkout',
      brand: { primary: '#0f766e' },
    });
    expect(layerOf(loaded.layers, '/overrides/color.link')?.file).toBe(loaded.layers[1]!.file);
    expect(loaded.config).toEqual(mergeThemes(mergeThemes(org!, brand!), checkout!));
    expect(loaded.config).toMatchObject({ name: 'checkout', brand: { primary: '#0f766e' } });
    expect(loaded.config).not.toHaveProperty('extends');
    // brand/base.theme.json removed the org's color.link override.
    expect(Object.keys((loaded.config as { overrides: object }).overrides)).toEqual([
      'color.surface.default',
    ]);
    expect(generate(loaded.config).ok).toBe(true);
  });

  it('resolves a package export with Node’s resolution, from the file’s folder', async () => {
    const loaded = await loadConfig(at('apps/kiosk/kiosk.theme.json'));
    expect(loaded.diagnostics).toEqual([]);
    expect(relative(dir, loaded.layers[0]!.file).replace(/\\/g, '/')).toBe(
      'node_modules/@acme/brand/base.theme.json',
    );
    const result = generate(loaded.config);
    expect(result.ok).toBe(true);
    expect(result.css).toMatch(
      /\[data-odd-product="lobby"\] \{[^}]*--odd-color-action-default: var\(--odd-ref-brand-700\)/,
    );
  });

  it('follows an absolute path, as a tool may write one', async () => {
    await write('abs/product.theme.json', { extends: at('org/org.theme.json'), name: 'abs' });
    const loaded = await loadConfig(at('abs/product.theme.json'));
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.layers.map((layer) => layer.file)).toEqual([
      at('org/org.theme.json'),
      at('abs/product.theme.json'),
    ]);
  });

  it('loads a JavaScript base under a JSON file', async () => {
    await write('js/base.theme.mjs', `export default ${JSON.stringify(ORG)};\n`);
    await write('js/product.theme.json', { extends: './base.theme.mjs', name: 'js-product' });
    const loaded = await loadConfig(at('js/product.theme.json'));
    expect(loaded.diagnostics).toEqual([]);
    // The base's $schema is not inherited.
    const { $schema: _schema, ...inherited } = structuredClone(ORG);
    expect(loaded.config).toEqual({ ...inherited, name: 'js-product' });
  });

  it('reports a cycle, a missing base, and an extends that names no file', async () => {
    await write('cycle/a.theme.json', { extends: './b.theme.json' });
    await write('cycle/b.theme.json', { extends: './a.theme.json', brand: { primary: '#000' } });
    const cycle = await loadConfig(at('cycle/a.theme.json'));
    expect(cycle.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['config.extends.cycle', '/extends'],
    ]);
    expect(cycle.diagnostics[0]?.message.replace(/\\/g, '/')).toContain(
      'cycle/a.theme.json → .tmp/extends-',
    );
    expect(cycle.config).toBeUndefined();

    await write('missing/product.theme.json', { extends: './nowhere.theme.json' });
    const missing = await loadConfig(at('missing/product.theme.json'));
    expect(missing.diagnostics.map((d) => d.code)).toEqual(['config.load']);
    expect(missing.diagnostics[0]?.message.replace(/\\/g, '/')).toContain(
      'missing/product.theme.json: cannot find its base "./nowhere.theme.json"',
    );

    // A path is used as written, relative or absolute: no extension is tried.
    for (const base of ['../org/org.theme', at('org/org.theme')]) {
      await write('written/product.theme.json', { extends: base });
      const loaded = await loadConfig(at('written/product.theme.json'));
      expect(loaded.diagnostics[0]?.message, base).toContain('cannot find its base');
    }

    await write('package/product.theme.json', { extends: '@acme/absent/base.theme.json' });
    const absent = await loadConfig(at('package/product.theme.json'));
    expect(absent.diagnostics[0]?.message).toContain(
      'cannot find its base "@acme/absent/base.theme.json"',
    );

    await write('typed/product.theme.json', { extends: 3, brand: { primary: '#000' } });
    const typed = await loadConfig(at('typed/product.theme.json'));
    expect(typed.diagnostics.map((d) => [d.code, d.path])).toEqual([['config.type', '/extends']]);

    await write('broken/base.theme.json', '{ "brand": ');
    await write('broken/product.theme.json', { extends: './base.theme.json' });
    const broken = await loadConfig(at('broken/product.theme.json'));
    expect(broken.diagnostics.map((d) => d.code)).toEqual(['config.load']);
    expect(broken.diagnostics[0]?.message.replace(/\\/g, '/')).toContain('broken/base.theme.json:');
  });
});

describe('oddkin-tokens with extends', { timeout: 30_000 }, () => {
  it('builds the merged theme byte for byte', async () => {
    const result = await cli('build', at('apps/checkout/checkout.theme.json'), '--out', at('out'));
    expect(result.code).toBe(0);
    const loaded = await loadConfig(at('apps/checkout/checkout.theme.json'));
    expect(await readFile(at('out/checkout.css'), 'utf8')).toBe(generate(loaded.config).css);
  });

  it('names the file each diagnostic’s value came from', async () => {
    await write('warn/base.theme.json', {
      brand: { primary: '#5b46e8' },
      overrides: { 'color.nope': '#ffffff' },
    });
    await write('warn/product.theme.json', {
      extends: './base.theme.json',
      overrides: { 'color.canvas': '{color.canvas}' },
    });
    const text = await cli('check', at('warn/product.theme.json'));
    expect(text.code).toBe(1);
    const lines = text.err.replace(/\\/g, '/').split('\n');
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^error override\.unknown \/overrides\/color\.nope \(\.tmp\/extends-\d+\/warn\/base\.theme\.json\): /,
      ),
    );
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^error alias\.\w+ \/overrides\/color\.canvas \(\.tmp\/extends-\d+\/warn\/product\.theme\.json\): /,
      ),
    );
    const json = await cli('check', at('warn/product.theme.json'), '--json');
    const reported = JSON.parse(json.out) as Array<{ path: string; file?: string }>;
    expect(
      reported.map((d) => [d.path, d.file?.replace(/\\/g, '/').replace(/^.*\/warn\//, '')]),
    ).toEqual([
      ['/overrides/color.nope', 'base.theme.json'],
      ['/overrides/color.canvas', 'product.theme.json'],
    ]);
  });
});
