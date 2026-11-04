import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NATIVE } from '@oddkin/components/composition';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  COMPOSITION_NATIVE,
  compositionCatalog,
  compositionFiles,
  compositionSchemas,
} from '../src/index.js';

// A library's composition catalog and schemas (P1.6, data-composition.md §8), from its manifest.
// The command needs the build (`npm run build`).
vi.setConfig({ testTimeout: 60_000 });

const repo = new URL('../../../', import.meta.url);
const path = (relative: string) => new URL(relative, repo).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const bin = path('packages/analyzer/dist/bin.js');
// @plain/widgets: plain custom elements with a hand-written manifest (single-quoted literals).
const PLAIN = path('tests/consumers/workbench/plain-widgets/custom-elements.json');
const plain = JSON.parse(readFileSync(PLAIN, 'utf8')) as unknown;
const temps: string[] = [];
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const CHIP = {
  attributes: {
    label: 'string',
    tone: { enum: ['neutral', 'info', 'warning'] },
    removable: 'boolean',
  },
  properties: { count: 'number' },
  fixed: [],
  slots: ['', 'icon'],
  events: ['plain-remove'],
};

/** A manifest with one element per case. */
const manifest = (declarations: Record<string, unknown>[]) => ({
  schemaVersion: '2.1.0',
  modules: [{ kind: 'javascript-module', path: 'index.js', declarations }],
});
const field = (name: string, text: string, extra: Record<string, unknown> = {}) => ({
  kind: 'field',
  name,
  type: { text },
  ...extra,
});

describe('compositionCatalog', () => {
  it("reads a library's manifest: attributes, writable properties, slots, and events", () => {
    expect(compositionCatalog(plain)).toEqual({ catalog: { 'plain-chip': CHIP }, diagnostics: [] });
  });

  it('types what JSON can carry, lists what it cannot, and warns about attributes it leaves out', () => {
    const { catalog, diagnostics } = compositionCatalog(
      manifest([
        { kind: 'class', name: 'Base' },
        {
          kind: 'class',
          name: 'Zeta',
          tagName: 'x-zeta',
          attributes: [
            { name: 'href', type: { text: 'string' } },
            { name: 'size', type: { text: 'number | undefined' } },
            { name: 'variant', type: { text: '"a" | "b"' } },
            { name: 'when', type: { text: 'Date' } },
            { name: 'open', type: { text: 'boolean' }, default: 'true' },
            { name: 'quiet', type: { text: 'boolean' } },
          ],
          members: [
            field('state', 'string', { readonly: true }),
            field('values', 'readonly string[] | undefined'),
            field('strings', 'Partial<{ close: string; open: string; }>'),
            field('items', 'readonly NavigationEntry[] | undefined'),
            field('options', 'readonly OptionRecord[] | undefined'),
            field('renderLabel', '(item: Item) => string'),
            field('size', 'number', { attribute: 'size' }),
            field('hidden', 'string', { privacy: 'private' }),
            field('count', 'number', { static: true }),
            field('_cache', 'string'),
            { kind: 'method', name: 'reset' },
          ],
          slots: [{ name: 'footer' }, { name: '' }],
          events: [{ name: 'x-change' }],
        },
        { kind: 'class', name: 'Alpha', tagName: 'x-alpha' },
        { kind: 'class', name: 'Again', tagName: 'x-alpha', slots: [{ name: '' }] },
      ]),
      { modelTypes: { NavigationEntry: 'oddkin.navigation' }, events: { 'x-zeta': ['click'] } },
    );
    // Sorted by tag; a tag declared twice keeps its first declaration.
    expect(Object.keys(catalog)).toEqual(['x-alpha', 'x-zeta']);
    expect(catalog['x-alpha']).toEqual({
      attributes: {},
      properties: {},
      fixed: [],
      slots: [],
      events: [],
    });
    expect(catalog['x-zeta']).toEqual({
      attributes: { href: 'url', size: 'number', variant: { enum: ['a', 'b'] }, quiet: 'boolean' },
      properties: {
        values: 'strings',
        strings: { texts: ['close', 'open'] },
        items: { model: 'oddkin.navigation' },
      },
      fixed: ['options', 'renderLabel', 'state'],
      slots: ['', 'footer'],
      events: ['click', 'x-change'],
    });
    expect(diagnostics).toEqual([
      {
        code: 'analyzer.composition.attributeType',
        severity: 'warning',
        message:
          'x-zeta: attribute "when" has a type a composition cannot write (Date); it is left out of the catalog.',
        suggestion: 'Type it as string, number, boolean, or a union of string literals.',
      },
      {
        code: 'analyzer.composition.booleanDefault',
        severity: 'warning',
        message:
          'x-zeta: boolean attribute "open" defaults to true; markup cannot turn it off, so it is left out of the catalog.',
        suggestion: 'Name the attribute for the state it turns on, defaulting to false.',
      },
    ]);
    // Without a model for its record type, a list is not portable.
    expect(
      compositionCatalog(
        manifest([{ tagName: 'x-nav', members: [field('items', 'readonly NavigationEntry[]')] }]),
      ).catalog['x-nav']?.fixed,
    ).toEqual(['items']);
    expect(compositionCatalog({}).catalog).toEqual({});
  });

  it('knows the native text elements @oddkin/components/composition renders', () => {
    expect(COMPOSITION_NATIVE).toEqual(NATIVE);
  });
});

describe('compositionSchemas', () => {
  const { catalog } = compositionCatalog(plain);

  it("writes one schema per element and the document's, from the manifest's descriptions", () => {
    const schemas = compositionSchemas(catalog, plain);
    expect(Object.keys(schemas)).toEqual(['plain-chip.v1.json', 'composition.v1.json']);
    const chip = schemas['plain-chip.v1.json'] as Record<string, unknown>;
    // No base: no $id, and references by file name.
    expect(chip).not.toHaveProperty('$id');
    expect(chip['$comment']).toBe(
      'Slots: default, "icon". A child names a slot with "slot"; text and children without "slot" go to the default slot.',
    );
    const properties = chip['properties'] as Record<string, Record<string, unknown>>;
    expect(properties['id']).toEqual({ $ref: 'composition.v1.json#/$defs/id' });
    expect(properties['attributes']?.['properties']).toMatchObject({
      label: { type: 'string', default: '', description: "The chip's text." },
      tone: { enum: ['neutral', 'info', 'warning'], default: 'neutral' },
      removable: { type: 'boolean', default: false },
    });
    expect(properties['properties']?.['properties']).toMatchObject({ count: { type: 'number' } });
    expect(properties['actions']).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: { 'plain-remove': { $ref: 'composition.v1.json#/$defs/action' } },
    });
    const document = schemas['composition.v1.json'] as Record<string, unknown>;
    expect(document['title']).toBe('Composition');
    const defs = document['$defs'] as Record<string, Record<string, unknown>>;
    expect(defs['node']?.['oneOf']).toContainEqual({ $ref: 'plain-chip.v1.json' });
    // Natives come with the attributes they take, checked as the validator checks them.
    expect(defs['native-a']?.['properties']).toMatchObject({
      attributes: { properties: { href: { type: 'string', format: 'uri-reference' } } },
    });
  });

  it('validates documents for the library with a JSON Schema validator', () => {
    const base = 'https://widgets.example/schemas/composition/';
    const schemas = compositionSchemas(catalog, plain, {
      base,
      title: '@plain/widgets composition',
    });
    expect(schemas['plain-chip.v1.json']?.['$id']).toBe(`${base}plain-chip.v1.json`);
    const ajv = new Ajv2020({
      allErrors: true,
      strict: true,
      strictRequired: false,
      allowUnionTypes: true,
    });
    addFormats.default(ajv);
    for (const schema of Object.values(schemas)) ajv.addSchema(schema);
    const validate = ajv.getSchema(`${base}composition.v1.json`)!;
    const chip = (attributes: Record<string, unknown>) => ({
      version: 1,
      root: [
        {
          element: 'plain-chip',
          attributes,
          children: ['Draft'],
          actions: { 'plain-remove': 'chip.remove' },
        },
      ],
    });
    expect(validate(chip({ label: 'Draft', tone: 'info' })), JSON.stringify(validate.errors)).toBe(
      true,
    );
    expect(validate(chip({ tone: 'loud' }))).toBe(false);
    expect(validate(chip({ onclick: 'alert(1)' }))).toBe(false);
  });

  it('refers to a published model by the URL it is given', () => {
    const { catalog: nav } = compositionCatalog(
      manifest([{ tagName: 'x-nav', members: [field('items', 'readonly NavigationEntry[]')] }]),
      { modelTypes: { NavigationEntry: 'oddkin.navigation' } },
    );
    const url = 'https://oddkin.dev/schemas/components/oddkin.navigation.v1.json';
    const schemas = compositionSchemas(nav, {}, { modelSchemas: { 'oddkin.navigation': url } });
    expect(schemas['x-nav.v1.json']?.['properties']).toMatchObject({
      properties: { properties: { items: { $ref: url } } },
    });
    expect(() => compositionSchemas(nav, {})).toThrow(
      /No schema URL for the model "oddkin.navigation"/,
    );
  });
});

describe('oddkin-analyze --composition', () => {
  it('writes the catalog and the schemas beside the metadata, for a library not built with Oddkin', () => {
    const out = mkdtempSync(join(tmpdir(), 'oddkin-composition-'));
    temps.push(out);
    const result = spawnSync(
      process.execPath,
      [bin, '--manifest', PLAIN, '--out', out, '--composition'],
      {
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(readdirSync(out).sort()).toEqual([
      'oddkin.composition.json',
      'oddkin.metadata.json',
      'schemas',
    ]);
    expect(readdirSync(join(out, 'schemas', 'composition')).sort()).toEqual([
      'composition.v1.json',
      'plain-chip.v1.json',
    ]);
    const { files } = compositionFiles(plain, { title: '@plain/widgets composition' });
    expect([...files.keys()]).toEqual([
      'oddkin.composition.json',
      'schemas/composition/plain-chip.v1.json',
      'schemas/composition/composition.v1.json',
    ]);
    for (const [file, text] of files)
      expect(readFileSync(join(out, ...file.split('/')), 'utf8'), file).toBe(text);
    expect(JSON.parse(files.get('oddkin.composition.json')!)).toEqual({
      version: 1,
      catalog: { 'plain-chip': CHIP },
    });
    expect(result.stdout).toContain('oddkin.composition.json');
  });
});
