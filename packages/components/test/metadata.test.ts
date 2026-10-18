import { existsSync, readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

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
});
