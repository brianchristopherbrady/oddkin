import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateComposition } from '@oddkin/components/composition';
import { contrastReport, emitInspectJson, generate, resolveToken } from '@oddkin/tokens/generate';
import { layerOf, mergeThemes } from '@oddkin/tokens/theme';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it, vi } from 'vitest';
import { STARTERS } from '../src/data/starters.js';
import { themeStudioPage } from '../src/data/theme-studio.js';
import type { ComponentPageData, ThemeStudioPageData } from '../src/data/types.js';
import { resolveWorkbenchConfig } from '../src/config/index.js';
import { DiagnosticList } from '../src/internal/diagnostics.js';
import { buildWorkbench, THEME_WORKER } from '../src/node/workbench.js';
import {
  exportBlocked,
  exportNames,
  fieldValue,
  getPath,
  parseDraft,
  pathText,
  setField,
  setPath,
  themeFields,
  type ThemeField,
} from '../src/panels/theme-model.js';
import { isFrameRequest } from '../src/protocol/index.js';
import { acmeProject, removeProject } from './node-project.js';

const component = (
  tag: string,
  examples: { name: string; roles?: string[]; slots?: Record<string, string> }[],
  registration: string | undefined = `@acme/ui/define/${tag}`,
): ComponentPageData => ({
  format: 'oddkin.workbench-page',
  version: 1,
  id: `components/${tag}`,
  kind: 'component',
  tag,
  package: '@acme/ui',
  module: 'x.js',
  declaration: {},
  ...(registration ? { enrichment: { registration } } : {}),
  examples: examples.map((e) => ({
    id: `example:${tag}/${e.name}`,
    name: e.name,
    ...(e.roles ? { previewRoles: e.roles.map((r) => `role:${r}`) } : {}),
    definition: {
      label: e.name,
      slots: e.slots ?? {},
      ...(e.roles ? { previewRoles: e.roles } : {}),
    },
  })),
});

const configWith = (roles?: Record<string, string | { component: string; example?: string }>) =>
  resolveWorkbenchConfig({
    library: { packages: ['@acme/ui'] },
    ...(roles ? { themeStudio: { preview: { roles } } } : {}),
  }).config!;

describe('Theme Studio editor model', () => {
  it('edits by path without touching other branches', () => {
    const draft = { brand: { primary: '#123456' }, overrides: { a: { light: '1', dark: '2' } } };
    const next = setPath(draft, ['overrides', 'a', 'light'], '3') as typeof draft;
    expect(next.overrides.a).toEqual({ light: '3', dark: '2' });
    expect(next.brand).toBe(draft.brand);
    expect(draft.overrides.a.light).toBe('1');
    expect(getPath(setPath(draft, ['brand', 'primary'], undefined), ['brand'])).toEqual({});
    expect(getPath(setPath({}, ['spacing', 'unit'], '4px'), ['spacing', 'unit'])).toBe('4px');
  });

  it('changes only the edited role in the edited mode, and the roles that reference it (workbench.md §6.4)', () => {
    const base = JSON.parse(
      readFileSync(resolve('packages/tokens/themes/default.theme.json'), 'utf8'),
    ) as object;
    const edited = setPath(base, ['overrides', 'color.action.default', 'light'], '#0a7d33');
    type Token = { name: string; definition: unknown; value: unknown };
    const tokens = (config: unknown) =>
      new Map(
        (
          JSON.parse(emitInspectJson(generate(config as never).theme!)) as { tokens: Token[] }
        ).tokens.map((t) => [t.name, t] as const),
      );
    const before = tokens(base);
    const after = tokens(edited);
    const changed = [...after.values()]
      .filter((t) => JSON.stringify(t.value) !== JSON.stringify(before.get(t.name)?.value))
      .map((t) => t.name);
    // What the edit may reach: the role itself and, through references, the roles that alias it.
    const reach = new Set(['color.action.default']);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of after.values())
        if (
          !reach.has(t.name) &&
          [...reach].some((name) => JSON.stringify(t.definition).includes(`{${name}}`))
        ) {
          reach.add(t.name);
          grew = true;
        }
    }
    expect(changed).toContain('color.action.default');
    expect(changed.length).toBeGreaterThan(1);
    expect(changed.filter((name) => !reach.has(name))).toEqual([]);
    // The explicit value, and in the light mode only.
    const value = (map: Map<string, Token>, name: string) =>
      map.get(name)!.value as { light: string; dark: string };
    expect(value(after, 'color.action.default').light).toBe('#0a7d33');
    for (const name of changed)
      expect(value(after, name).dark, name).toBe(value(before, name).dark);
  });

  it('offers only the fields that apply to the draft, overrides by mode', () => {
    const groups = themeFields({
      brand: { primary: '#6250e8' },
      spacing: { strategy: 'ratio', base: '1rem', ratio: 1.5, stepsBelow: 2, stepsAbove: 3 },
      overrides: { 'color.canvas': { light: '#fff', dark: '#000' }, 'radius.md': '6px' },
    });
    expect(groups.map((g) => g.id)).toEqual(['inputs', 'spacing', 'shape', 'overrides']);
    expect(groups[0]?.fields.map((f) => f.path.join('.'))).toEqual([
      'brand.primary',
      'brand.neutral',
      'status.danger',
      'status.success',
      'status.warning',
      'status.info',
    ]);
    expect(groups[0]?.fields[0]).toMatchObject({ value: '#6250e8', origin: 'foundation input' });
    expect(groups[1]?.fields.map((f) => f.path[1])).toEqual([
      'base',
      'ratio',
      'stepsBelow',
      'stepsAbove',
      'snap',
    ]);
    expect(
      themeFields({ spacing: { strategy: 'multiples', unit: '4px', steps: {} } })[1]?.fields.map(
        (f) => f.path[1],
      ),
    ).toEqual(['unit', 'snap']);
    expect(themeFields({})[1]?.fields).toEqual([]);
    const overrides = groups[3]!;
    expect(overrides.modes).toEqual(['light', 'dark']);
    expect(overrides.rows?.map((r) => r.cells.map((c) => c.path.join('.')))).toEqual([
      ['overrides.color.canvas.light', 'overrides.color.canvas.dark'],
      ['overrides.radius.md'],
    ]);
    expect(overrides.rows?.[0]?.cells[0]).toMatchObject({ origin: 'explicit override' });
  });

  it('says which file sets each value of a draft on bases, as the merge of theme files does', () => {
    const root = {
      brand: { primary: '#123456', neutral: '#777777' },
      spacing: { strategy: 'multiples', unit: '4px', snap: '2px' },
      overrides: { 'color.canvas': { light: '#fff', dark: '#000' }, 'radius.md': '6px' },
    };
    const mid = {
      extends: './root.json',
      brand: { neutral: '#666666' },
      status: { info: '#0055aa' },
      overrides: { 'radius.md': null },
    };
    const product = {
      extends: './mid.json',
      brand: { neutral: '#888888' },
      overrides: { 'color.link': { light: '#00f', dark: '#99f' } },
    };
    const bases = [
      { file: 'root.json', config: root },
      { file: 'mid.json', config: mid },
    ];
    const groups = themeFields(product, bases);
    const fields = groups.flatMap((g) => [...g.fields, ...(g.rows ?? []).flatMap((r) => r.cells)]);
    const at = (path: string) => fields.find((f) => pathText(f.path) === path)!;
    expect(at('/brand/primary')).toMatchObject({
      value: undefined,
      unit: ['brand', 'primary'],
      inherited: { file: 'root.json', value: '#123456' },
    });
    expect(at('/brand/neutral')).toMatchObject({ value: '#888888' });
    expect(at('/brand/neutral')).not.toHaveProperty('inherited');
    // The nearest base that sets a value wins over the root's.
    expect(
      themeFields({}, bases)
        .flatMap((g) => g.fields)
        .find((f) => f.label === 'Neutral')?.inherited,
    ).toEqual({ file: 'mid.json', value: '#666666' });
    expect(at('/status/info').inherited).toEqual({ file: 'mid.json', value: '#0055aa' });
    expect(at('/status/danger').inherited).toBeUndefined();
    // Spacing is merged whole: its fields follow the base's strategy and belong to its file.
    expect(groups[1]?.fields.map((f) => [f.path[1], f.unit, f.inherited])).toEqual([
      ['unit', ['spacing'], { file: 'root.json', value: '4px' }],
      ['snap', ['spacing'], { file: 'root.json', value: '2px' }],
    ]);
    // Overrides merge by token: the base's, less the one a base removes, then the draft's own.
    expect(groups[3]?.rows?.map((r) => [r.token, r.inherited])).toEqual([
      ['color.canvas', 'root.json'],
      ['color.link', undefined],
    ]);
    expect(at('/overrides/color.canvas/dark').inherited).toEqual({
      file: 'root.json',
      value: '#000',
    });
    expect(at('/overrides/color.link/light').value).toBe('#00f');
    // The file each field names is the one @oddkin/tokens' layerOf names for what is merged whole.
    const layers = [...bases, { file: 'product.json', config: product }];
    const owner = (field: ThemeField) =>
      field.inherited?.file ??
      (getPath(product, field.unit) === undefined ? undefined : 'product.json');
    for (const field of fields)
      expect(layerOf(layers, pathText(field.unit))?.file, pathText(field.path)).toBe(owner(field));
    // Without bases, nothing is inherited; overrides that are not an object replace the bases'.
    expect(
      themeFields(root)
        .flatMap((g) => g.fields)
        .some((f) => f.inherited),
    ).toBe(false);
    expect(themeFields({ overrides: null }, bases)[3]?.rows).toEqual([]);
  });

  it('offers the shape, motion, type, and gamut inputs, the corners and gamut as choices', () => {
    const base = {
      radius: { scale: 2 },
      typography: { scale: { base: '1rem', ratio: 1.2 } },
      gamut: 'p3',
    };
    const bases = [{ file: 'base.json', config: base }];
    const draft = { extends: './base.json', motion: { scale: 0.5 }, overrides: {} };
    const shape = themeFields(draft, bases).find((g) => g.id === 'shape')!;
    expect(shape.fields.map((f) => [pathText(f.path), f.kind, f.origin, f.value])).toEqual([
      ['/radius/scale', 'choice', 'foundation input', undefined],
      ['/overrides/control.radius', 'choice', 'explicit override', undefined],
      ['/motion/scale', 'number', 'foundation input', 0.5],
      ['/typography/scale/base', 'length', 'foundation input', undefined],
      ['/typography/scale/ratio', 'number', 'foundation input', undefined],
      ['/gamut', 'choice', 'foundation input', undefined],
    ]);
    const at = (path: string) => shape.fields.find((f) => pathText(f.path) === path)!;
    const [corners, pill, gamut] = ['/radius/scale', '/overrides/control.radius', '/gamut'].map(at);
    expect(corners?.inherited).toEqual({ file: 'base.json', value: 2 });
    expect(corners?.options?.map(([, value]) => value)).toEqual([0, 0.5, 1, 2, 3]);
    expect(gamut?.inherited).toEqual({ file: 'base.json', value: 'p3' });
    // A choice writes the option's value: a number for the radius scale, an alias for pill.
    expect(fieldValue(corners!, '0.5')).toBe(0.5);
    expect(fieldValue(pill!, '{radius.full}')).toBe('{radius.full}');
    expect(fieldValue(gamut!, 'srgb')).toBe('srgb');
    expect(fieldValue(corners!, '')).toBeUndefined();
    expect(setField(draft, pill!, '{radius.full}', bases)).toEqual({
      ...draft,
      overrides: { 'control.radius': '{radius.full}' },
    });
    // The type scale is replaced whole, as the merge replaces it: an edit keeps the base's base.
    expect(setField(draft, at('/typography/scale/ratio'), 1.25, bases)).toEqual({
      ...draft,
      typography: { scale: { base: '1rem', ratio: 1.25 } },
    });
    expect(setField(draft, at('/motion/scale'), undefined, bases)).toEqual({
      ...draft,
      motion: {},
    });
    // A product sets brand inputs and overrides only.
    expect(themeFields({}, bases, true).map((g) => g.id)).toEqual(['inputs', 'overrides']);
  });

  it('edits a draft on bases without copying more than the merge replaces', () => {
    const base = {
      brand: { primary: '#123456' },
      spacing: { strategy: 'multiples', unit: '4px', snap: '2px' },
      overrides: { 'color.canvas': { light: '#fff', dark: '#000' } },
    };
    const bases = [{ file: 'base.json', config: base }];
    const product = { extends: './base.json' };
    const fields = themeFields(product, bases).flatMap((g) => [
      ...g.fields,
      ...(g.rows ?? []).flatMap((r) => r.cells),
    ]);
    const at = (path: string) => fields.find((f) => pathText(f.path) === path)!;
    // A value merged by name is set alone.
    expect(setField(product, at('/brand/primary'), '#0a7d33', bases)).toEqual({
      extends: './base.json',
      brand: { primary: '#0a7d33' },
    });
    // Spacing and an override's token are replaced whole: the draft takes them, then the edit.
    const spaced = setField(product, at('/spacing/unit'), '8px', bases);
    expect(spaced).toEqual({
      extends: './base.json',
      spacing: { strategy: 'multiples', unit: '8px', snap: '2px' },
    });
    const dark = setField(product, at('/overrides/color.canvas/dark'), '#111', bases);
    expect(dark).toEqual({
      extends: './base.json',
      overrides: { 'color.canvas': { light: '#fff', dark: '#111' } },
    });
    // Merged as the CLI merges them, each edit is the base with only that change.
    expect(mergeThemes(base, spaced as object)['spacing']).toEqual({
      strategy: 'multiples',
      unit: '8px',
      snap: '2px',
    });
    expect(mergeThemes(base, dark as object)['overrides']).toEqual({
      'color.canvas': { light: '#fff', dark: '#111' },
    });
    // Clearing what the draft inherits changes nothing; clearing its own value removes it.
    expect(setField(product, at('/brand/primary'), undefined, bases)).toBe(product);
    expect(setField(spaced, themeFields(spaced, bases)[1]!.fields[0]!, undefined, bases)).toEqual({
      extends: './base.json',
      spacing: { strategy: 'multiples', snap: '2px' },
    });
    // The base is never changed.
    expect(base.spacing.unit).toBe('4px');
    expect(base.overrides['color.canvas'].dark).toBe('#000');
  });

  it('turns entries into configuration values and never applies broken JSON', () => {
    const [ratio] = themeFields({ spacing: { strategy: 'ratio' } })[1]!.fields.filter(
      (f) => f.path[1] === 'ratio',
    );
    expect(fieldValue(ratio!, ' 1.25 ')).toBe(1.25);
    expect(fieldValue(ratio!, '')).toBeUndefined();
    expect(parseDraft('{"brand":{}}')).toEqual({ ok: true, value: { brand: {} } });
    expect(parseDraft('{"brand":').ok).toBe(false);
    expect(parseDraft('[1]')).toMatchObject({
      ok: false,
      message: expect.stringContaining('object'),
    });
  });

  it("exports the draft shown under the theme file's name, only once it is generated", () => {
    expect(exportNames('./oddkin.theme.json')).toEqual({
      config: 'oddkin.theme.json',
      css: 'oddkin.theme.css',
    });
    expect(exportNames('../../packages/tokens/themes/default.theme.json').css).toBe(
      'default.theme.css',
    );
    expect(exportNames('C:\\themes\\brand.config.ts')).toEqual({
      config: 'brand.config.json',
      css: 'brand.config.css',
    });
    expect(exportNames(undefined)).toEqual({ config: 'theme.json', css: 'theme.css' });

    const ready = { generator: true, jsonError: false, unavailable: '', pending: false, ok: true };
    expect(exportBlocked(ready)).toBe('');
    expect(exportBlocked({ ...ready, generator: false })).toContain('theme generator');
    // The editor's text does not parse: the draft is not the one shown.
    expect(exportBlocked({ ...ready, jsonError: true })).toContain('JSON has an error');
    expect(exportBlocked({ ...ready, unavailable: 'no worker' })).toBe(
      'Generation unavailable: no worker',
    );
    // A newer draft than the last result, or none yet: never an older draft as the latest.
    expect(exportBlocked({ ...ready, pending: true })).toBe('Generating the latest draft…');
    expect(exportBlocked({ ...ready, ok: undefined })).toBe('Generating the latest draft…');
    expect(exportBlocked({ ...ready, ok: false })).toContain('invalid');
  });
});

describe('Theme Studio page data', () => {
  it('maps roles from examples that claim them, never by tag name', () => {
    const out = new DiagnosticList();
    const page = themeStudioPage(
      'theme-studio',
      [
        component('acme-button', [
          { name: 'default', slots: { default: 'Go' } },
          { name: 'primary', roles: ['primaryAction'], slots: { default: 'Save' } },
        ]),
        component('acme-card', [{ name: 'plain' }]),
        component('acme-badge', [{ name: 'a', roles: ['badge'] }]),
        component('acme-chip', [{ name: 'b', roles: ['badge'] }]),
      ],
      configWith(),
      { config: { brand: { primary: '#123456' } }, source: './theme.json', worker: '/w.js' },
      out,
    );
    expect(page.studio.roles).toEqual([
      expect.objectContaining({
        role: 'primaryAction',
        label: 'Primary action',
        tag: 'acme-button',
        registration: '@acme/ui/define/acme-button',
        example: 'example:acme-button/primary',
        slots: { '': 'Save' },
        source: 'example',
      }),
    ]);
    // Two components claim `badge`: unmapped, and the page says how to choose.
    expect(page.studio.missing).toContainEqual({
      item: 'role:badge',
      supply: 'themeStudio.preview.roles.badge (claimed by acme-badge/a, acme-chip/b)',
    });
    // acme-card claims nothing, so `surface` is missing even though a card exists.
    expect(page.studio.missing.map((m) => m.item)).toContain('role:surface');
    expect(page.studio.missing.map((m) => m.item)).not.toContain('config');
    expect(out.items).toEqual([]);
  });

  it('lets configuration choose a role, and diagnoses one it cannot resolve', () => {
    const out = new DiagnosticList();
    const page = themeStudioPage(
      'theme-studio',
      [
        component('acme-badge', [{ name: 'a', roles: ['badge'] }]),
        component('acme-chip', [{ name: 'default', roles: ['badge'] }]),
        component('acme-button', [{ name: 'primary', roles: ['primaryAction'] }]),
      ],
      configWith({
        badge: 'acme-chip',
        primaryAction: 'acme-chip',
        surface: { component: 'acme-missing' },
      }),
      {},
      out,
    );
    // Configuration wins over an example's claim, ambiguous or not.
    expect(page.studio.roles.map((r) => [r.role, r.tag, r.source])).toEqual([
      ['badge', 'acme-chip', 'config'],
      ['primaryAction', 'acme-chip', 'config'],
    ]);
    expect(out.items.map((d) => [d.code, d.path])).toEqual([
      ['data.themeStudio.role', '/themeStudio/preview/roles/surface'],
    ]);
    expect(page.studio.missing.slice(0, 2).map((m) => m.item)).toEqual(['generator', 'config']);
  });

  it("offers each component's examples as a screen, and documents when a package renders them", () => {
    const out = new DiagnosticList();
    const mark = (page: ComponentPageData, marks: Record<string, object>): ComponentPageData => ({
      ...page,
      examples: page.examples.map((e) => ({
        ...e,
        definition: { ...(e['definition'] as object), ...marks[e['name'] as string] },
      })),
    });
    const button = mark(
      component('acme-button', [
        { name: 'default', slots: { default: 'Go' } },
        { name: 'wrong' },
        { name: 'setup' },
      ]),
      { wrong: { incorrect: { explanation: 'Not like this.' } }, setup: { hasFixture: true } },
    );
    // Its fixture needs the page's example module, which this page lacks: a screen runs no setup
    // code, so it shows the published values all the same.
    const chip = mark(component('acme-chip', [{ name: 'a' }, { name: 'b' }]), {
      b: { hasFixture: true },
    });
    const pages = [
      { ...button, exampleModule: '/acme-button.examples.js' },
      // An example whose values were not published has nothing to show.
      { ...chip, examples: [...chip.examples, { id: 'example:acme-chip/raw', name: 'raw' }] },
      { ...component('acme-card', [{ name: 'plain' }]), enrichment: {} },
      { ...component('acme-badge', [{ name: 'a' }]), package: '@acme/other' },
      // Its only example needs its setup code: shown by its values, without that code.
      {
        ...mark(component('acme-dialog', [{ name: 'open' }]), { open: { hasFixture: true } }),
        exampleModule: '/acme-dialog.examples.js',
      },
      // Without the example module as well.
      mark(component('acme-sheet', [{ name: 'open' }]), { open: { hasFixture: true } }),
    ];
    const page = themeStudioPage('theme-studio', pages, configWith(), {}, out, {
      titles: new Map([
        ['components/acme-button', 'Button'],
        ['components/acme-chip', 'Chip'],
      ]),
      composition: { renderer: '@acme/ui/composition', packages: ['@acme/ui'] },
    });
    expect(page.studio.screens?.components).toEqual([
      // By title; a page without one keeps its tag.
      {
        tag: 'acme-badge',
        title: 'acme-badge',
        items: [expect.objectContaining({ role: 'a' })],
        omitted: [],
      },
      {
        tag: 'acme-dialog',
        title: 'acme-dialog',
        items: [expect.objectContaining({ role: 'open', label: 'open (without its setup code)' })],
        omitted: [],
      },
      {
        tag: 'acme-sheet',
        title: 'acme-sheet',
        items: [expect.objectContaining({ role: 'open', label: 'open (without its setup code)' })],
        omitted: [],
      },
      {
        tag: 'acme-button',
        title: 'Button',
        items: [
          {
            role: 'default',
            label: 'default',
            tag: 'acme-button',
            registration: '@acme/ui/define/acme-button',
            example: 'example:acme-button/default',
            properties: {},
            attributes: {},
            slots: { '': 'Go' },
          },
          // Beside an example without setup code, one with it is shown by its values too.
          expect.objectContaining({ role: 'setup', label: 'setup (without its setup code)' }),
        ],
        omitted: [],
      },
      {
        tag: 'acme-chip',
        title: 'Chip',
        items: [
          expect.objectContaining({ role: 'a' }),
          expect.objectContaining({ role: 'b', label: 'b (without its setup code)' }),
        ],
        omitted: ['raw'],
      },
    ]);
    // Documents may use the renderer's package's registered elements; no starters but Oddkin's.
    expect(page.studio.screens?.composition).toEqual({
      renderer: '@acme/ui/composition',
      registrations: {
        'acme-button': '@acme/ui/define/acme-button',
        'acme-chip': '@acme/ui/define/acme-chip',
        'acme-dialog': '@acme/ui/define/acme-dialog',
        'acme-sheet': '@acme/ui/define/acme-sheet',
      },
      starters: [],
    });
    // A package without a renderer of its own: its generated catalog goes with the documents, and
    // Oddkin's renderer brings the stylesheet its native containers use.
    const badge = { attributes: {}, properties: {}, fixed: [], slots: [''], events: [] };
    const generated = themeStudioPage('theme-studio', pages, configWith(), {}, out, {
      titles: new Map(),
      composition: {
        renderer: '@oddkin/components/composition',
        packages: ['@acme/other'],
        catalog: { 'acme-badge': badge },
      },
    });
    expect(generated.studio.screens?.composition).toEqual({
      renderer: '@oddkin/components/composition',
      registrations: { 'acme-badge': '@acme/ui/define/acme-badge' },
      catalog: { 'acme-badge': badge },
      stylesheets: ['@oddkin/components/css/layout.css'],
      starters: [],
    });
    // Oddkin's starters need Oddkin's renderer, whose catalog holds their elements.
    const elsewhere = themeStudioPage('theme-studio', pages, configWith(), {}, out, {
      titles: new Map(),
      composition: {
        renderer: '@acme/ui/composition',
        packages: ['@acme/ui', '@oddkin/components'],
      },
    });
    expect(elsewhere.studio.screens?.composition?.starters).toEqual([]);
    const without = themeStudioPage('theme-studio', pages, configWith(), {}, out);
    expect(without.studio.screens?.composition).toBeUndefined();
    expect(without.studio.screens?.components.map((c) => c.title)).toEqual([
      'acme-badge',
      'acme-button',
      'acme-chip',
      'acme-dialog',
      'acme-sheet',
    ]);
    expect(out.items).toEqual([]);
  });

  it("starts Oddkin's composition screens from documents valid by both checks", () => {
    const repo = new URL('../../../', import.meta.url);
    const dir = new URL('packages/components/schemas/composition/', repo);
    const ajv = new Ajv2020({ strict: false });
    addFormats.default(ajv);
    // The published model schemas the element schemas reference (navigation, the table's).
    const models = new URL('packages/components/schemas/', repo);
    for (const file of readdirSync(models).filter((name) => name.endsWith('.v1.json')))
      ajv.addSchema(JSON.parse(readFileSync(new URL(file, models), 'utf8')));
    for (const file of readdirSync(dir))
      ajv.addSchema(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
    const schema = ajv.getSchema('https://oddkin.dev/schemas/composition/composition.v1.json')!;
    expect(STARTERS.map((s) => s.title)).toEqual([
      'Report card',
      'Settings form',
      'Sign-in dialog',
      'App layout',
    ]);
    for (const starter of STARTERS) {
      expect(schema(starter.document), JSON.stringify(schema.errors)).toBe(true);
      expect(validateComposition(starter.document), starter.id).toEqual({
        ok: true,
        diagnostics: [],
      });
      // An editor loads the installed copy; the schema's $id is only its name.
      expect(starter.document['$schema']).toBe(
        './node_modules/@oddkin/components/schemas/composition/composition.v1.json',
      );
    }
  });

  // A whole build of the Oddkin fixture, as in node-build.test.ts: 15 s alone on a busy machine,
  // past the default limit when the other test files run beside it.
  it(
    "builds Oddkin's own Theme Studio from its theme file and generator",
    { timeout: 120_000 },
    async () => {
      const build = await buildWorkbench({ config: 'tests/fixtures/workbench-oddkin' });
      const page = JSON.parse(build.files.get('pages/theme-studio.json')!) as ThemeStudioPageData;
      expect(page.studio.source).toBe('../../../packages/tokens/themes/default.theme.json');
      expect(page.studio.config).toMatchObject({
        name: 'default',
        brand: { primary: expect.any(String) },
      });
      expect(page.studio.worker).toBe(`/_oddkin/${THEME_WORKER}`);
      expect(page.studio.roles.map((r) => `${r.role}:${r.tag}`)).toEqual([
        'surface:odd-card',
        'badge:odd-badge',
        'textInput:odd-input',
        'checkbox:odd-checkbox',
        'switch:odd-switch',
        'primaryAction:odd-button',
        'secondaryAction:odd-button',
        'navigation:odd-side-nav',
        // Roles the specimen recipe does not draw follow, in catalog order.
        'alert:odd-alert',
        'avatar:odd-avatar',
        'busyIndicator:odd-spinner',
        'calendar:odd-calendar',
        'chip:odd-chip',
        'colorPicker:odd-color-picker',
        'combobox:odd-combobox',
        'copyButton:odd-copy-button',
        'datePicker:odd-date-picker',
        'disclosure:odd-disclosure',
        'fileInput:odd-file-input',
        'oneTimeCode:odd-one-time-code',
        'picker:odd-picker',
        'placeholder:odd-skeleton',
        'progress:odd-progress',
        'radioGroup:odd-radio-group',
        'rating:odd-rating',
        'relativeTime:odd-relative-time',
        'segmented:odd-segmented-control',
        'slider:odd-slider',
        'stat:odd-stat',
        'statusMarker:odd-status-marker',
        'table:odd-table',
        'textArea:odd-textarea',
        'tree:odd-tree',
      ]);
      const worker = build.files.get(THEME_WORKER)!;
      // Workers have no import map: the library's own generator, by URL, and its own merge of
      // theme files on a base.
      expect(worker).toContain(
        `import * as tokens from ${JSON.stringify(build.frameImportMap?.imports['@oddkin/tokens/generate'])};`,
      );
      expect(worker).toContain(
        `import { mergeThemes } from ${JSON.stringify(build.frameImportMap?.imports['@oddkin/tokens/theme'])};`,
      );
      // The default theme extends no base: one draft, as before.
      expect(page.studio.files).toBeUndefined();
      expect(build.diagnostics.filter((d) => d.code.startsWith('node.themeStudio'))).toEqual([]);
      // Screens: every component with examples, and documents for @oddkin/components' renderer.
      const screens = page.studio.screens!;
      expect(screens.components.find((c) => c.tag === 'odd-button')).toMatchObject({
        title: 'Button',
        items: expect.arrayContaining([expect.objectContaining({ role: 'primary' })]),
      });
      expect(screens.composition).toMatchObject({
        renderer: '@oddkin/components/composition',
        registrations: { 'odd-card': '@oddkin/components/define/card' },
        stylesheets: ['@oddkin/components/css/layout.css'],
        starters: STARTERS,
      });
      // The frame resolves the stylesheet through its import map.
      expect(build.frameImportMap?.imports['@oddkin/components/css/layout.css']).toMatch(
        /\/dist\/css\/layout\.css$/,
      );
      // Each element the starters use is registered. @oddkin/ai has no renderer of its own: its
      // elements come with the catalog the analyzer generates from its manifest (P1.6).
      const tags = JSON.stringify(STARTERS)
        .match(/"element":"odd-[a-z-]+"/g)!
        .map((t) => JSON.parse(t.slice('"element":'.length)));
      for (const tag of tags) expect(screens.composition?.registrations).toHaveProperty([tag]);
      expect(screens.composition?.registrations).toHaveProperty(['odd-message']);
      expect(screens.composition?.catalog).toHaveProperty(['odd-message']);
      expect(screens.composition?.catalog).not.toHaveProperty(['odd-card']);
      expect(build.frameImportMap?.imports['@oddkin/components/composition']).toBeDefined();
    },
  );

  it("merges a draft's bases and gives each product's values, in Theme Studio's Worker", async () => {
    const dir = acmeProject();
    try {
      const build = await buildWorkbench({ config: dir });
      const imports = build.frameImportMap?.imports ?? {};
      // The Worker as built, importing the workspace's own @oddkin/tokens from disk.
      let text = build.files.get(THEME_WORKER) ?? '';
      for (const name of ['generate', 'theme'])
        text = text.replace(
          JSON.stringify(imports[`@oddkin/tokens/${name}`]),
          JSON.stringify(pathToFileURL(resolve(`packages/tokens/dist/${name}/index.js`)).href),
        );
      const replies: Record<string, unknown>[] = [];
      let listener: ((event: { data: unknown }) => void) | undefined;
      vi.stubGlobal('self', {
        addEventListener: (_type: string, handle: typeof listener) => (listener = handle),
        postMessage: (message: Record<string, unknown>) => replies.push(message),
      });
      const file = join(dir, 'theme-studio.worker.mjs');
      writeFileSync(file, text);
      await import(pathToFileURL(file).href);
      const run = (draft: object, bases: object[], products?: string[]) => {
        listener?.({
          data: { id: replies.length, draft, bases, ...(products ? { products } : {}) },
        });
        return replies.at(-1) as { ok: boolean; css?: string; values?: Record<string, string> };
      };
      const canvas = (light: string) => ({ 'color.canvas': { light, dark: '#101010' } });
      const base = { brand: { primary: '#123456' }, overrides: canvas('#ffffff') };
      const products = {
        kiosk: { brand: { primary: '#aa0000' }, overrides: canvas('#fafafa') },
        lobby: {},
      };
      const product = { extends: './base.json', products };
      const first = run(product, [base], ['kiosk', 'lobby']);
      expect(first).toMatchObject({ ok: true, values: { kiosk: expect.any(String) } });
      expect(first.css).toContain('[data-odd-product="kiosk"]');
      // An edit to the base's canvas changes lobby, which inherits it, not kiosk, which sets its
      // own; an edit to its primary changes both, as kiosk's ramps it does not re-declare (the
      // info tone) follow the theme's: values, not keys, say which products change.
      const rebased = run(product, [{ ...base, overrides: canvas('#eeeeee') }], ['kiosk', 'lobby']);
      expect(rebased.values?.['kiosk']).toBe(first.values?.['kiosk']);
      expect(rebased.values?.['lobby']).not.toBe(first.values?.['lobby']);
      const primary = run(
        product,
        [{ ...base, brand: { primary: '#0a7d33' } }],
        ['kiosk', 'lobby'],
      );
      expect(primary.values?.['lobby']).not.toBe(first.values?.['lobby']);
      // An edit to one product, to its overrides or its brand, leaves another's values byte for
      // byte (multi-product.md §3), and so does a new product.
      const edited = {
        ...product,
        products: { ...products, kiosk: { ...products.kiosk, overrides: canvas('#f0f0f0') } },
      };
      const isolated = run(edited, [base], ['kiosk', 'lobby']);
      expect(isolated.values?.['lobby']).toBe(first.values?.['lobby']);
      expect(isolated.values?.['kiosk']).not.toBe(first.values?.['kiosk']);
      const rebranded = {
        ...product,
        products: { ...products, kiosk: { ...products.kiosk, brand: { primary: '#00aa55' } } },
      };
      const brand = run(rebranded, [base], ['kiosk', 'lobby']);
      expect(brand.values?.['lobby']).toBe(first.values?.['lobby']);
      expect(brand.values?.['kiosk']).not.toBe(first.values?.['kiosk']);
      const added = {
        ...product,
        products: { ...products, museum: { brand: { primary: '#6250e8' } } },
      };
      expect(run(added, [base], ['lobby']).values).toEqual({ lobby: first.values?.['lobby'] });
      // The file is merged on its base, not under it: its own primary wins whatever the base's.
      const own = { ...product, brand: { primary: '#222222' } };
      const lobby = run(own, [base], ['lobby']).values;
      expect(run(own, [{ ...base, brand: { primary: '#999999' } }], ['lobby']).values).toEqual(
        lobby,
      );
      expect(lobby?.['lobby']).not.toBe(first.values?.['lobby']);
      // Without products, no values.
      expect(run(base, [])).not.toHaveProperty('values');
      // With a view (a product, or '' for the theme), the reply carries that one's views: each
      // ramp step's value, and the library's own contrast report of its role pairs.
      const view = (name: string) => {
        listener?.({ data: { id: replies.length, draft: product, bases: [base], view: name } });
        return (replies.at(-1) as { views?: { ramps: unknown[]; contrast: unknown[] } }).views;
      };
      const merged = generate(mergeThemes(base, product)).theme!;
      const steps = [...merged.tokens.keys()].filter((name) => name.startsWith('ref.'));
      expect(steps).toContain('ref.brand.500');
      for (const name of ['', 'kiosk']) {
        const views = view(name);
        expect(views?.ramps).toEqual(
          steps.map((step) => [step, resolveToken(merged, step, { product: name })]),
        );
        expect(views?.contrast).toEqual(
          contrastReport(merged).filter((pair) => (pair.product ?? '') === name),
        );
        expect(views?.contrast.length).toBeGreaterThan(0);
      }
      expect(view('kiosk')?.ramps).not.toEqual(view('')?.ramps);
      expect(run(product, [base], ['kiosk'])).not.toHaveProperty('views');
      // A library with only resolveToken gives the same values, one token at a time.
      const generator = JSON.stringify(
        pathToFileURL(resolve('packages/tokens/dist/generate/index.js')).href,
      );
      const older = join(dir, 'older-generate.mjs');
      writeFileSync(
        older,
        `import * as tokens from ${generator};\nexport const { generate, resolveToken } = tokens;\n`,
      );
      const olderWorker = join(dir, 'older.worker.mjs');
      writeFileSync(
        olderWorker,
        text.replace(generator, JSON.stringify(pathToFileURL(older).href)),
      );
      await import(pathToFileURL(olderWorker).href);
      expect(run(product, [base], ['kiosk', 'lobby']).values).toEqual(first.values);
      // Without a contrast report, a library's Worker sends no views.
      expect(view('')).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
      removeProject(dir);
    }
  });

  it('validates specimen requests like mounts, item by item', () => {
    const envelope = { protocol: 'oddkin.frame', version: 1, frame: 'f', generation: 1, id: 1 };
    const item = {
      role: 'primaryAction',
      label: 'Primary action',
      tag: 'acme-button',
      registration: '/x.js',
      example: 'example:acme-button/primary',
    };
    expect(isFrameRequest({ ...envelope, kind: 'specimen', payload: { items: [item] } })).toBe(
      true,
    );
    expect(
      isFrameRequest({ ...envelope, kind: 'specimen', payload: { items: [{ ...item, role: 1 }] } }),
    ).toBe(false);
    expect(
      isFrameRequest({
        ...envelope,
        kind: 'specimen',
        payload: { items: [{ ...item, example: 'example:other/primary' }] },
      }),
    ).toBe(false);
  });

  it('validates composition requests: a renderer, registrations by tag, and a JSON document', () => {
    const envelope = { protocol: 'oddkin.frame', version: 1, frame: 'f', generation: 1, id: 1 };
    const payload = {
      renderer: '@acme/ui/composition',
      registrations: { 'acme-button': '/x.js' },
      document: { version: 1, root: [] },
    };
    const request = (value: unknown) =>
      isFrameRequest({ ...envelope, kind: 'composition', payload: value });
    expect(request(payload)).toBe(true);
    // The renderer judges the document; the protocol only needs JSON.
    expect(request({ ...payload, document: null, settings: { mode: 'dark' } })).toBe(true);
    expect(request({ ...payload, catalog: { 'acme-chip': { slots: [''] } } })).toBe(true);
    for (const bad of [
      { ...payload, renderer: '' },
      { ...payload, renderer: 1 },
      { ...payload, registrations: ['/x.js'] },
      { ...payload, registrations: { 'acme-button': 1 } },
      { renderer: payload.renderer, registrations: payload.registrations },
      { ...payload, settings: { mode: 'sepia' } },
      { ...payload, catalog: ['acme-chip'] },
      { ...payload, catalog: { 'acme-chip': () => {} } },
    ])
      expect(request(bad), JSON.stringify(bad)).toBe(false);
  });
});
