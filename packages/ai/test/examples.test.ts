/// <reference types="vite/client" />
import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  checkExamples,
  toExamplesJSON,
  validateUsage,
  type ExampleSet,
} from '@oddkin/workbench/examples';

// Colocated @oddkin/ai examples (ADR 0021) checked against the published contract, like the
// @oddkin/components ones. They are excluded from the package build.

const files = import.meta.glob<ExampleSet>('../src/**/*.examples.ts', {
  eager: true,
  import: 'default',
});
const sets = Object.values(files);
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

describe('@oddkin/ai examples', () => {
  it('give every element a default example', async () => {
    const tags = (await declarations()).flatMap((d) => (d.tagName ? [d.tagName] : []));
    expect(sets.map((set) => set.component).sort()).toEqual(tags.sort());
    for (const set of sets) expect(set.examples['default'], set.component).toBeDefined();
  });

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
    }
  });

  it('are listed in the published metadata exactly as the analyzer read them statically', async () => {
    const metadata = await read<{ examples?: Record<string, Record<string, unknown>> }>(
      '../oddkin.metadata.json',
    );
    // Examples whose values the source computes (imported or built at run time): the analyzer
    // records no definition for them.
    const computed = new Set([
      'odd-checkpoint/default',
      'odd-checkpoint/restored',
      'odd-voice-input/default',
    ]);
    const expected = Object.fromEntries(
      Object.entries(files).flatMap(([path, set]) =>
        Object.entries(set.examples).map(([name, example]) => [
          `example:${set.component}/${name}`,
          {
            component: `component:${set.component}`,
            name,
            file: path.replace(/^\.\.\//, ''),
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
            ...(computed.has(`${set.component}/${name}`)
              ? {}
              : { definition: toExamplesJSON(set).examples[name] }),
          },
        ]),
      ),
    );
    expect(metadata.examples).toEqual(expected);
  });
});
