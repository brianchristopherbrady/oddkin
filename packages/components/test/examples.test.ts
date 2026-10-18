import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { checkExamples, toExamplesJSON, type ExampleSet } from '@oddkin/workbench/examples';
import button from '../src/button/button.examples.js';
import card from '../src/card/card.examples.js';
import input from '../src/input/input.examples.js';
import sideNav from '../src/side-nav/side-nav.examples.js';

// Colocated examples (ADR 0021) checked against the published contract. They are excluded
// from the package build; these tests and the browser tests are their consumers.

// Each set is typed for its own element; checks here only need the common shape.
const sets = [button, card, input, sideNav] as unknown as ExampleSet[];
const read = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as T;

interface Declaration {
  tagName?: string;
  members?: { kind: string; name: string; readonly?: boolean; static?: boolean }[];
  attributes?: { name: string }[];
  slots?: { name: string }[];
}

describe('component examples', () => {
  it('use only public properties, attributes, and slots from the published CEM', async () => {
    const cem = (await read('../custom-elements.json')) as {
      modules: { declarations?: Declaration[] }[];
    };
    const declarations = cem.modules.flatMap((module) => module.declarations ?? []);
    for (const set of sets) {
      const declaration = declarations.find((d) => d.tagName === set.component)!;
      const properties = (declaration.members ?? [])
        .filter((m) => m.kind === 'field' && !m.static && !m.readonly)
        .map((m) => m.name);
      const slots = (declaration.slots ?? []).map((s) => s.name);
      expect(checkExamples(set, { properties, slots }), set.component).toEqual([]);
      const attributes = new Set((declaration.attributes ?? []).map((a) => a.name));
      for (const [name, example] of Object.entries(set.examples))
        for (const attribute of Object.keys(example.attributes ?? {}))
          expect(attributes.has(attribute), `${set.component}/${name} [${attribute}]`).toBe(true);
    }
  });

  it('serialize to examples.v1', async () => {
    const schema = await read<object>('../../../docs/schemas/examples.v1.schema.json');
    const validate = new Ajv2020({ strict: false }).compile(schema);
    for (const set of sets) {
      const json = toExamplesJSON(set);
      expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
      // Fixtures are code: only their presence is portable.
      expect(Object.values(json.examples).some((e) => 'fixture' in e)).toBe(false);
    }
  });

  it('cover a default, every declared preview role, and an in-form fixture for form controls', async () => {
    const metadata = (await read('../oddkin.metadata.json')) as {
      components: Record<string, { previewRoles?: string[] }>;
    };
    for (const set of sets) {
      expect(set.examples['default'], set.component).toBeDefined();
      const declared = (metadata.components[`component:${set.component}`]?.previewRoles ?? []).map(
        (role) => role.replace(/^role:/, ''),
      );
      const shown = Object.values(set.examples).flatMap((e) => e.previewRoles ?? []);
      expect(declared.length, set.component).toBeGreaterThan(0);
      expect([...new Set(shown)].sort(), set.component).toEqual([...declared].sort());
    }
    for (const set of [button, input]) {
      expect(set.examples['inForm']?.fixture, set.component).toBeTypeOf('function');
    }
  });
});
