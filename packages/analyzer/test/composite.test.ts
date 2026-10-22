import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it, vi } from 'vitest';
import { analyze } from '../src/index.js';

// ADR 0043: a composite renders its definition's dependencies through roles
// (`@oddkin/core/template/roles`), so a recomposed composite's children are known statically from
// `dependencies` and its template's anatomy is read without executing it.

vi.setConfig({ testTimeout: 30_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const oddkinAjv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(oddkinAjv);
const validateOddkin = oddkinAjv.compile(
  JSON.parse(
    await readFile(new URL('docs/schemas/oddkin-metadata.v1.schema.json', repo), 'utf8'),
  ) as object,
);

const result = analyze({ project: path('tests/fixtures/analyzer-composite/tsconfig.json') });
const metadata = result.metadata as {
  components: Record<string, { definition?: Record<string, unknown> }>;
};
const declaration = (name: string) =>
  (result.manifest as { modules: Array<{ declarations?: Array<Record<string, unknown>> }> }).modules
    .flatMap((m) => m.declarations ?? [])
    .find((d) => d['name'] === name) as Record<string, unknown>;
const names = (list: unknown) =>
  ((list ?? []) as Array<{ name: string }>).map((x) => x.name).sort();

describe('composites with roles (ADR 0043)', () => {
  it('emits valid, diagnostic-free metadata without executing modules', () => {
    expect(validateOddkin(result.metadata), JSON.stringify(validateOddkin.errors)).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("maps each composite's roles to its own family, and the product's to the product's", () => {
    expect(metadata.components['component:acme-rows']?.definition).toMatchObject({
      template: { name: 'rowsTemplate' },
      dependencies: { button: 'component:acme-button', field: 'component:acme-field' },
    });
    expect(metadata.components['component:studio-rows']?.definition).toMatchObject({
      extends: 'component:acme-rows',
      template: { name: 'rowsTemplate' },
      dependencies: { button: 'component:studio-button', field: 'component:studio-field' },
    });
  });

  it('reads slots and parts from composite templates, including parts on role elements', () => {
    expect(names(declaration('AcmeRows')['cssParts'])).toEqual(['action', 'field', 'list', 'row']);
    expect(names(declaration('AcmeRows')['slots'])).toEqual(['empty']);
    expect(names(declaration('StudioRows')['cssParts'])).toEqual([
      'action',
      'field',
      'list',
      'row',
    ]);
  });
});
