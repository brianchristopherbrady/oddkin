import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buildPageRegistry, type CemPackage } from '@oddkin/workbench/pages';

// Published metadata produced by `npm run build` (scripts/build-metadata.mjs).
const pkg = new URL('../', import.meta.url);
const repo = new URL('../../../', import.meta.url);
const json = (url: URL) => JSON.parse(readFileSync(url, 'utf8')) as Record<string, any>;
const manifest = json(new URL('package.json', pkg));
const cem = json(new URL('custom-elements.json', pkg));
const metadata = json(new URL('oddkin.metadata.json', pkg));

describe('@oddkin/components published metadata', () => {
  it('validates against the pinned CEM schema and oddkin-metadata.v1', () => {
    const validateCem = new Ajv({ strict: false }).compile(
      json(new URL('node_modules/custom-elements-manifest/schema.json', repo)),
    );
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allowUnionTypes: true });
    addFormats.default(ajv);
    const validateOddkin = ajv.compile(
      json(new URL('docs/schemas/oddkin-metadata.v1.schema.json', repo)),
    );
    expect(validateCem(cem), JSON.stringify(validateCem.errors)).toBe(true);
    expect(validateOddkin(metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(metadata['diagnostics']).toEqual([]);
  });

  it('is declared and published by the package', () => {
    expect(manifest['customElements']).toBe('./custom-elements.json');
    expect(manifest['exports']['./custom-elements.json']).toBe('./custom-elements.json');
    expect(manifest['exports']['./oddkin.metadata.json']).toBe('./oddkin.metadata.json');
    expect(manifest['files']).toEqual(
      expect.arrayContaining(['custom-elements.json', 'oddkin.metadata.json']),
    );
  });

  it('every module path exists in the build and every registration is a package export', () => {
    for (const module of cem['modules'] as { path: string }[])
      expect(existsSync(new URL(module.path, pkg)), module.path).toBe(true);
    for (const component of Object.values(metadata['components']) as {
      registration: string;
      cem: { module: string };
    }[]) {
      const subpath = `.${component.registration.slice('@oddkin/components'.length)}`;
      expect(manifest['exports'][subpath], component.registration).toBeDefined();
      expect(existsSync(new URL(component.cem.module, pkg))).toBe(true);
    }
  });

  it('describes odd-button from its definition, template, and styles', () => {
    const button = metadata['components']['component:odd-button'];
    expect(button.registration).toBe('@oddkin/components/define/button');
    expect(button.previewRoles).toEqual(['role:primaryAction', 'role:secondaryAction']);
    expect(button.definition.template).toEqual({
      module: 'dist/button/button.template.js',
      name: 'buttonTemplate',
    });
    const tokens = (button.tokenReads as { token: string }[]).map((t) => t.token);
    expect(tokens).toContain('color.action.default');
    expect(tokens.some((t) => t.startsWith('--odd-button-'))).toBe(false);
    const declaration = (cem['modules'] as { declarations: Record<string, any>[] }[])
      .flatMap((m) => m.declarations)
      .find((d) => d['name'] === 'OddkinButton')!;
    expect(declaration['tagName']).toBe('odd-button');
    expect((declaration['cssParts'] as { name: string }[]).map((p) => p.name)).toEqual([
      'control',
      'spinner',
    ]);
    expect((declaration['slots'] as { name: string }[]).map((s) => s.name)).toEqual([
      '',
      'end',
      'start',
    ]);
    expect((declaration['members'] as { name: string }[]).map((m) => m.name)).not.toContain(
      '_formDisabled',
    );
  });

  it('states which properties take only property values and what each event reports', () => {
    const facts = (tag: string) => {
      const entry = metadata['components'][`component:${tag}`];
      return {
        propertyOnly: (entry.propertyOnly ?? []).map((p: { property: string }) => p.property),
        intents: Object.fromEntries(
          (entry.events ?? []).map((e: { event: string; intent: Record<string, unknown> }) => [
            e.event,
            e.intent['known'] === false ? 'unknown' : e.intent['value'],
          ]),
        ),
      };
    };
    expect(facts('odd-side-nav')).toEqual({
      propertyOnly: [
        'property:odd-side-nav#expanded',
        'property:odd-side-nav#items',
        'property:odd-side-nav#kinds',
        'property:odd-side-nav#renderLabel',
      ],
      intents: { 'event:odd-side-nav#odd-action': 'user', 'event:odd-side-nav#odd-toggle': 'user' },
    });
    // `value` is an accessor; the `value` attribute sets `defaultValue`.
    expect(facts('odd-input')).toEqual({
      propertyOnly: ['property:odd-input#value'],
      intents: { 'event:odd-input#change': 'user', 'event:odd-input#input': 'user' },
    });
    expect(facts('odd-button')).toEqual({ propertyOnly: [], intents: {} });
    expect(facts('odd-card')).toEqual({ propertyOnly: [], intents: {} });
  });

  it('lists customization paths; ladder levels only where the source declares them', () => {
    const customization = (tag: string) =>
      metadata['components'][`component:${tag}`].customization as {
        levels: Record<string, unknown>;
        variables: string[];
        parts: string[];
        slots: string[];
      };
    // Level 3 is exercised by derived-side-nav (packages/components/test/derived.ts).
    expect(customization('odd-side-nav').levels).toMatchObject({
      value: [1, 2, 3],
      provenance: 'authored',
    });
    expect(customization('odd-side-nav').slots).toEqual([
      'slot:odd-side-nav#default',
      'slot:odd-side-nav#footer',
      'slot:odd-side-nav#header',
    ]);
    expect(customization('odd-side-nav').parts).toContain('part:odd-side-nav#group-toggle');
    for (const tag of ['odd-button', 'odd-card', 'odd-input'])
      expect(customization(tag).levels, tag).toEqual({ known: false, provenance: 'extracted' });
    expect(customization('odd-button').variables).toContain(
      'cssprop:odd-button#--odd-button-radius',
    );
    // Nothing in the slice is deprecated yet.
    for (const tag of ['odd-button', 'odd-card', 'odd-input', 'odd-side-nav'])
      expect(metadata['components'][`component:${tag}`].deprecations, tag).toBeUndefined();
  });

  it('traces options and states to tokens, and publishes each style source for reuse', () => {
    const traces = (tag: string) =>
      (metadata['components'][`component:${tag}`].styleMappings as Record<string, string>[]).map(
        (m) => `${m['part'] ?? 'host'} | ${m['when']} | ${m['cssProperty']} -> ${m['token']}`,
      );
    expect(traces('odd-button')).toEqual(
      expect.arrayContaining([
        'control | default | background -> color.surface.raised',
        'control | appearance="primary" | background -> color.action.default',
        'control | appearance="primary" (enabled, hover) @media (hover: hover) | background -> color.action.hover',
        'control | appearance="primary" (active, enabled) | background -> color.action.pressed',
        'control | (disabled) | color -> color.text.disabled',
        'control | size="lg" | font-size -> type.body.size',
      ]),
    );
    // The structural sheet's `color: inherit` loads first, so the visual sheet's token wins.
    expect(traces('odd-button')).toContain('control | default | color -> color.text.primary');
    // `.root .entry:disabled` (forced colours) is outside the grammar: the entries' colour is unread.
    expect(traces('odd-side-nav').filter((t) => / color -> /.test(t))).toEqual([
      'base | default | color -> color.text.primary',
      'badge | default | color -> color.text.secondary',
    ]);
    expect(metadata['styles']['dist/styles/focus-ring.styles.js#focusRingStyles'].css).toMatch(
      /:focus-visible \{\s*outline: token\(focus\.width\) solid token\(color\.focus\.ring\);/,
    );
  });

  it('publishes category labels, so the Workbench catalog groups components by them', () => {
    expect(metadata['categories']).toMatchObject({
      'category:actions': { label: 'Actions' },
      'category:containers': { label: 'Containers' },
      'category:forms': { label: 'Forms' },
      'category:navigation': { label: 'Navigation' },
    });
    const { registry, diagnostics } = buildPageRegistry({
      config: { library: { packages: ['@oddkin/components'] } },
      cem: cem as CemPackage,
      metadata,
    });
    expect(diagnostics.filter((d) => d.code === 'pages.category.unknown')).toEqual([]);
    const groups = Object.fromEntries(
      (registry?.pages ?? []).filter((p) => p.kind === 'component').map((p) => [p.id, p.group]),
    );
    // Every component is grouped under its own category's label.
    const components = metadata['components'] as Record<string, { tag: string; category: string }>;
    expect(groups).toEqual(
      Object.fromEntries(
        Object.values(components).map((c) => [
          `components/${c.tag}`,
          (metadata['categories'] as Record<string, { label: string }>)[c.category]!.label,
        ]),
      ),
    );
    expect(groups['components/odd-side-nav']).toBe('Navigation');
  });

  it('dates component and foundation pages from source history, as Workbench shows them', () => {
    const shallow =
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: fileURLToPath(repo),
        encoding: 'utf8',
      }).trim() !== 'false';
    const docs = metadata['docs'] as Record<string, { updated: Record<string, string> }>;
    // Without full history there is no date to give; build time is never one.
    if (shallow) return expect(docs).toBeUndefined();
    const pages = [
      ...Object.keys(metadata['components']).map((id) => `components/${id.slice(10)}`),
      ...Object.values(metadata['foundations'] as Record<string, { id: string }>).map(
        (f) => `foundations/${f.id}`,
      ),
    ].sort();
    expect(Object.keys(docs)).toEqual(pages);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    for (const { updated } of Object.values(docs)) {
      expect(updated['provenance']).toBe('extracted');
      expect(updated['value']! <= tomorrow).toBe(true);
    }
    const { registry, diagnostics } = buildPageRegistry({
      config: { library: { packages: ['@oddkin/components'] } },
      cem: cem as CemPackage,
      metadata,
    });
    expect(registry, JSON.stringify(diagnostics)).toBeDefined();
    expect(diagnostics.filter((d) => d.code === 'content.page.unknown')).toEqual([]);
    for (const [id, { updated }] of Object.entries(docs))
      expect(registry?.pages.find((p) => p.id === id)?.updated, id).toBe(updated['value']);
  });
});
