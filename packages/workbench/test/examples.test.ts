import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  checkExamples,
  defineExamples,
  exampleId,
  toExamplesJSON,
  validateUsage,
} from '../src/examples/index.js';
import type { CemPackage } from '../src/pages/index.js';

const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);
const validExamples = ajv.compile(json('../../../docs/schemas/examples.v1.schema.json'));

// The contract an example is checked against comes from the analyzer's CEM output.
const cem = json('../../analyzer/test/fixtures/core-counter.custom-elements.json') as CemPackage;
const greeting = cem.modules
  .flatMap((m) => m.declarations ?? [])
  .find((d) => d.tagName === 'demo-greeting');
const contract = {
  properties: (greeting?.members ?? [])
    .filter((m) => m.kind === 'field' && !m.static)
    .map((m) => m.name),
  slots: (greeting?.slots ?? []).map((s) => s.name),
};

const examples = defineExamples('demo-greeting', {
  default: { props: { name: 'Ada' }, preset: true },
  excited: {
    props: { name: 'Grace', excited: true },
    attributes: { tone: 'warm' },
    recommended: true,
  },
  inForm: {
    guidance: 'Shows the greeting inside a form.',
    fixture: ({ scope, element }) => {
      scope.add(() => element.remove());
    },
  },
});

describe('defineExamples', () => {
  it('is a frozen, DOM-free definition', () => {
    expect(Object.isFrozen(examples)).toBe(true);
    expect(Object.keys(examples.examples)).toEqual(['default', 'excited', 'inForm']);
    expect(exampleId('demo-greeting', 'excited')).toBe('example:demo-greeting/excited');
  });

  it('serializes to examples.v1 with fixtures reduced to a flag', () => {
    const data = toExamplesJSON(examples);
    expect(validExamples(data), JSON.stringify(validExamples.errors)).toBe(true);
    expect(data.examples['inForm']).toEqual({
      guidance: 'Shows the greeting inside a form.',
      hasFixture: true,
    });
    expect(JSON.stringify(data)).not.toContain('scope');
  });

  it('checks plain-JavaScript examples against the analyzed contract', () => {
    expect(contract.properties).toContain('name');
    expect(checkExamples(examples, contract)).toEqual([]);
    const loose = defineExamples('demo-greeting' as string, {
      typo: { props: { nmae: 'Ada' }, slots: { footer: 'x' } },
      'bad name': {},
    });
    expect(checkExamples(loose, contract).map((d) => [d.code, d.path])).toEqual([
      ['examples.prop.unknown', '/examples/typo/props/nmae'],
      ['examples.slot.unknown', '/examples/typo/slots/footer'],
      ['examples.name.invalid', '/examples/bad name'],
    ]);
    expect(checkExamples(defineExamples('Bad', {})).map((d) => d.code)).toEqual([
      'examples.component.invalid',
    ]);
  });

  // Everything validateUsage needs is in the published CEM: field types and attribute links.
  const usage = {
    properties: (greeting?.members ?? [])
      .map(
        (m) => m as typeof m & { readonly?: boolean; type?: { text?: string }; attribute?: string },
      )
      .filter((m) => m.kind === 'field' && !m.static && !m.readonly)
      .map((m) => ({ name: m.name, type: m.type?.text, attribute: m.attribute })),
    slots: (greeting?.slots ?? []).map((s) => s.name),
  };
  const mistake = (diagnostic: string) => ({
    explanation: 'Explained.',
    diagnostic,
    correct: 'default',
  });

  it('pairs each incorrect example with the diagnostic validateUsage reports for it', () => {
    const set = defineExamples('demo-greeting', {
      default: { props: { name: 'Ada', history: ['a'] }, attributes: { tone: 'warm' } },
      global: { attributes: { id: 'g', 'data-x': '1', 'aria-label': 'Hi', excited: '' } },
      historyAttribute: {
        attributes: { history: '["a"]' },
        incorrect: mistake('usage.attribute.propertyOnly'),
      },
      excitedFalse: { attributes: { excited: 'false' }, incorrect: mistake('usage.boolean.false') },
      loudTone: { attributes: { tone: 'loud' }, incorrect: mistake('usage.attribute.value') },
      unknownAttribute: {
        attributes: { mood: 'x' },
        incorrect: mistake('usage.attribute.unknown'),
      },
      unknownSlot: { slots: { footer: 'x' }, incorrect: mistake('usage.slot.unknown') },
    });
    expect(checkExamples(set)).toEqual([]);
    const found = validateUsage(set, usage);
    for (const [name, example] of Object.entries(set.examples)) {
      const codes = found
        .filter((d) => d.path?.startsWith(`/examples/${name}/`))
        .map((d) => d.code);
      expect(codes, name).toEqual(example.incorrect ? [example.incorrect.diagnostic] : []);
    }
    expect(found.find((d) => d.code === 'usage.attribute.value')?.message).toContain(
      'plain, warm, formal',
    );
    expect(validExamples(toExamplesJSON(set)), JSON.stringify(validExamples.errors)).toBe(true);
  });

  it('names the attribute a camelCase property is reflected to', () => {
    const button = {
      properties: [{ name: 'fullWidth', type: 'boolean', attribute: 'full-width' }],
      slots: [''],
    };
    const set = defineExamples('acme-button' as string, {
      camel: { attributes: { fullWidth: '' }, slots: { default: 'Save' } },
    });
    expect(validateUsage(set, button).map((d) => d.message)).toEqual([
      '<acme-button> has no attribute "fullWidth"; use "full-width".',
    ]);
  });

  it('keeps incorrect examples out of presets and recommendations', () => {
    const set = defineExamples('demo-greeting' as string, {
      default: {},
      promoted: {
        preset: true,
        previewRoles: ['default'],
        incorrect: mistake('usage.slot.unknown'),
      },
      orphan: { incorrect: { explanation: ' ', diagnostic: 'Bad', correct: 'promoted' } },
    });
    expect(checkExamples(set).map((d) => [d.code, d.path])).toEqual([
      ['examples.incorrect.recommended', '/examples/promoted'],
      ['examples.incorrect.correct', '/examples/orphan/incorrect/correct'],
      ['examples.incorrect.explanation', '/examples/orphan/incorrect'],
    ]);
  });
});
