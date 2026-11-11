import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  METADATA_SCHEMA_FILE,
  METADATA_TYPES_FILE,
  generateMetadataTypes,
} from '../../scripts/build-metadata-types.mjs';

// Draft schemas live in docs/schemas until their owning packages exist (M3/M5).
const dir = fileURLToPath(new URL('../../docs/schemas/', import.meta.url));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const schemaFiles = readdirSync(dir).filter((file) => file.endsWith('.v1.schema.json'));
const validators = new Map(
  schemaFiles.map((file) => [
    file.replace('.v1.schema.json', ''),
    ajv.compile(read(join(dir, file)) as object),
  ]),
);
const examples = readdirSync(join(dir, 'examples')).filter((file) => file.endsWith('.json'));

describe('draft JSON Schemas', () => {
  it('compiles every schema under Ajv 2020 strict mode', () => {
    expect(validators.size).toBe(schemaFiles.length);
    expect(schemaFiles.length).toBeGreaterThanOrEqual(8);
  });

  it.each(examples)('%s gives the expected result', (file) => {
    const validate = validators.get(file.split('.')[0] ?? '');
    expect(validate, `no schema for ${file}`).toBeDefined();
    const valid = validate!(read(join(dir, 'examples', file)));
    expect(valid, JSON.stringify(validate!.errors)).toBe(file.includes('.valid.'));
  });

  // Copies the packages publish for editors and exported artifacts (scripts/sync-tool-schemas.mjs).
  it.each([
    ['workbench', ['docs-content', 'workbench-config']],
    [
      'analyzer',
      ['check-result', 'comparison-snapshot', 'impact-report', 'oddkin-metadata', 'product'],
    ],
  ])('@oddkin/%s publishes its copies unchanged', (name, schemas) => {
    const pkg = fileURLToPath(new URL(`../../packages/${name}/`, import.meta.url));
    const manifest = read(join(pkg, 'package.json')) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(manifest.files).toContain('schemas');
    expect(manifest.exports['./schemas/*.json']).toBe('./schemas/*.json');
    expect(readdirSync(join(pkg, 'schemas')).sort()).toEqual(
      schemas.map((schema) => `${schema}.v1.schema.json`),
    );
    for (const schema of schemas)
      expect(
        readFileSync(join(pkg, 'schemas', `${schema}.v1.schema.json`), 'utf8'),
        `${name}/schemas/${schema}: run node scripts/sync-tool-schemas.mjs`,
      ).toBe(readFileSync(join(dir, `${schema}.v1.schema.json`), 'utf8'));
  });
});

// The browser-safe metadata types (`@oddkin/analyzer/metadata/types`), generated from the
// canonical schema by scripts/build-metadata-types.mjs (P1.6).
describe('metadata types', () => {
  it('are current with the canonical oddkin-metadata v1 schema', async () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const expected = await generateMetadataTypes(read(join(root, METADATA_SCHEMA_FILE)) as object);
    expect(
      readFileSync(join(root, METADATA_TYPES_FILE), 'utf8'),
      `${METADATA_TYPES_FILE} is stale: run node scripts/build-metadata-types.mjs`,
    ).toBe(expected);
    expect(expected).not.toMatch(/^\s*import\b|\bimport\s*\(|<reference\s/m);
  });

  it('read each form the schema uses, and fail on any other keyword', async () => {
    const text = await generateMetadataTypes({
      $id: 'https://example.com/x.json',
      type: 'object',
      required: ['kind', 'facts'],
      properties: {
        kind: { enum: ['a', 'b'] },
        fixed: { const: 'v1' },
        facts: { type: 'array', items: { $ref: '#/$defs/fact' } },
        named: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } },
        source: { oneOf: [{ $ref: '#/$defs/fact' }, { type: 'string', pattern: '^x' }] },
      },
      $defs: {
        fact: {
          type: 'object',
          required: ['provenance'],
          properties: { provenance: { enum: ['extracted', 'authored'] }, value: {} },
        },
        tagged: { allOf: [{ $ref: '#/$defs/fact' }, { properties: { tag: { type: 'string' } } }] },
      },
    });
    expect(text).toContain("export type OddkinMetadataSchema = 'https://example.com/x.json';");
    expect(text).toContain("readonly kind: 'a' | 'b';");
    expect(text).toContain("readonly fixed?: 'v1';");
    expect(text).toContain('readonly facts: readonly Fact[];');
    expect(text).toContain('readonly named?: Readonly<Record<string, number>>;');
    expect(text).toContain('readonly source?: Fact | string;');
    expect(text).toContain('export interface Fact {');
    expect(text).toContain('readonly value?: unknown;');
    expect(text).toMatch(/export type Tagged = Fact & \{\s+readonly tag\?: string;\s+\};/);
    await expect(
      generateMetadataTypes({ type: 'object', properties: { x: { dependentRequired: {} } } }),
    ).rejects.toThrow('#/properties/x: the generator does not read "dependentRequired"');
    await expect(
      generateMetadataTypes({ properties: { x: { $ref: 'other.json#/a' } } }),
    ).rejects.toThrow('only local $defs references are read');
  });
});
