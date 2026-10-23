import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { checkExamples, toExamplesJSON, validateUsage } from '@oddkin/workbench/examples';
import button from '../src/button/button.examples.js';
import input from '../src/input/input.examples.js';
import { exampleSets } from './catalog.js';

// Colocated examples (ADR 0021) checked against the published contract. They are excluded
// from the package build; these tests and the browser tests are their consumers.

const sets = Object.values(exampleSets);
const read = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as T;

interface Declaration {
  tagName?: string;
  members?: {
    kind: string;
    name: string;
    readonly?: boolean;
    static?: boolean;
    type?: { text: string };
    attribute?: string;
  }[];
  attributes?: { name: string }[];
  slots?: { name: string }[];
}

const declarations = async () =>
  (
    (await read('../custom-elements.json')) as { modules: { declarations?: Declaration[] }[] }
  ).modules.flatMap((module) => module.declarations ?? []);

describe('component examples', () => {
  it('use only public properties, attributes, and slots from the published CEM', async () => {
    const all = await declarations();
    for (const set of sets) {
      const declaration = all.find((d) => d.tagName === set.component)!;
      const properties = (declaration.members ?? [])
        .filter((m) => m.kind === 'field' && !m.static && !m.readonly)
        .map((m) => m.name);
      const slots = (declaration.slots ?? []).map((s) => s.name);
      expect(checkExamples(set, { properties, slots }), set.component).toEqual([]);
      const attributes = new Set((declaration.attributes ?? []).map((a) => a.name));
      for (const [name, example] of Object.entries(set.examples))
        if (!example.incorrect)
          for (const attribute of Object.keys(example.attributes ?? {}))
            expect(attributes.has(attribute), `${set.component}/${name} [${attribute}]`).toBe(true);
    }
  });

  it('pair each explained mistake with the diagnostic the published contract gives it', async () => {
    const all = await declarations();
    const covered = new Set<string>();
    for (const set of sets) {
      const declaration = all.find((d) => d.tagName === set.component)!;
      const found = validateUsage(set, {
        properties: (declaration.members ?? [])
          .filter((m) => m.kind === 'field' && !m.static && !m.readonly)
          .map((m) => ({ name: m.name, type: m.type?.text, attribute: m.attribute })),
        slots: (declaration.slots ?? []).map((s) => s.name),
      });
      for (const [name, example] of Object.entries(set.examples)) {
        const codes = found
          .filter((d) => d.path?.startsWith(`/examples/${name}/`))
          .map((d) => d.code);
        const label = `${set.component}/${name}`;
        expect(codes, label).toEqual(example.incorrect ? [example.incorrect.diagnostic] : []);
        if (example.incorrect) covered.add(example.incorrect.diagnostic);
      }
    }
    expect([...covered].sort()).toEqual([
      'usage.attribute.propertyOnly',
      'usage.attribute.unknown',
      'usage.attribute.value',
      'usage.boolean.false',
      'usage.slot.unknown',
    ]);
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

  it('are listed in the published metadata exactly as the analyzer read them statically', async () => {
    const metadata = await read<{ examples?: Record<string, Record<string, unknown>> }>(
      '../oddkin.metadata.json',
    );
    // Elements each fixture renders besides its own, read from literal markup.
    const uses: Record<string, string[]> = {
      'odd-alert/danger': ['component:odd-button'],
      'odd-button/inForm': ['component:odd-input'],
      'odd-card/headed': ['component:odd-button'],
      'odd-empty-state/default': ['component:odd-button'],
      'odd-input/inForm': ['component:odd-button'],
      'odd-tab-panel/default': ['component:odd-tabs'],
      ...Object.fromEntries(
        ['default', 'manual', 'vertical', 'disabledTab', 'orientationColumn'].map((name) => [
          `odd-tabs/${name}`,
          ['component:odd-tab-panel'],
        ]),
      ),
    };
    const expected = Object.fromEntries(
      sets.flatMap((set) =>
        Object.entries(set.examples).map(([name, example]) => [
          `example:${set.component}/${name}`,
          {
            component: `component:${set.component}`,
            name,
            file: `src/${set.component.replace(/^odd-/, '')}/${set.component.replace(/^odd-/, '')}.examples.ts`,
            ...(example.fixture ? { hasFixture: true } : {}),
            ...(example.previewRoles
              ? { previewRoles: example.previewRoles.map((role) => `role:${role}`) }
              : {}),
            ...(example.incorrect
              ? {
                  incorrect: {
                    diagnostic: example.incorrect.diagnostic,
                    correct: `example:${set.component}/${example.incorrect.correct}`,
                  },
                }
              : {}),
            ...(uses[`${set.component}/${name}`] ? { uses: uses[`${set.component}/${name}`] } : {}),
          },
        ]),
      ),
    );
    expect(metadata.examples).toEqual(expected);
  });
});
