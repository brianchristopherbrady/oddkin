import { describe, expect, it } from 'vitest';
import { themeStudioPage } from '../src/data/theme-studio.js';
import type { ComponentPageData, ThemeStudioPageData } from '../src/data/types.js';
import { resolveWorkbenchConfig } from '../src/config/index.js';
import { DiagnosticList } from '../src/internal/diagnostics.js';
import { buildWorkbench, THEME_WORKER } from '../src/node/workbench.js';
import {
  fieldValue,
  getPath,
  parseDraft,
  setPath,
  themeFields,
} from '../src/panels/theme-model.js';
import { isFrameRequest } from '../src/protocol/index.js';

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

  it('offers only the fields that apply to the draft, overrides by mode', () => {
    const groups = themeFields({
      brand: { primary: '#6250e8' },
      spacing: { strategy: 'ratio', base: '1rem', ratio: 1.5, stepsBelow: 2, stepsAbove: 3 },
      overrides: { 'color.canvas': { light: '#fff', dark: '#000' }, 'radius.md': '6px' },
    });
    expect(groups.map((g) => g.id)).toEqual(['inputs', 'spacing', 'overrides']);
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
    const overrides = groups[2]!;
    expect(overrides.modes).toEqual(['light', 'dark']);
    expect(overrides.rows?.map((r) => r.cells.map((c) => c.path.join('.')))).toEqual([
      ['overrides.color.canvas.light', 'overrides.color.canvas.dark'],
      ['overrides.radius.md'],
    ]);
    expect(overrides.rows?.[0]?.cells[0]).toMatchObject({ origin: 'explicit override' });
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

  it("builds Oddkin's own Theme Studio from its theme file and generator", async () => {
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
      'textArea:odd-textarea',
      'tree:odd-tree',
    ]);
    const worker = build.files.get(THEME_WORKER)!;
    // Workers have no import map: the library's own generator, by URL.
    expect(worker).toContain(
      `import { generate } from ${JSON.stringify(build.frameImportMap?.imports['@oddkin/tokens/generate'])};`,
    );
    expect(build.diagnostics.filter((d) => d.code.startsWith('node.themeStudio'))).toEqual([]);
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
});
