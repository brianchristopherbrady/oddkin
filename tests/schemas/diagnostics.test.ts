import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it, vi } from 'vitest';
import { analyze } from '@oddkin/analyzer';
import { NavigationItemModel } from '@oddkin/components/models';
import { collection } from '@oddkin/core/collections';
import { generate } from '@oddkin/tokens/generate';
import { checkExamples } from '@oddkin/workbench/examples';

// diagnostic.v1 is an envelope over the existing shapes (agent-tooling.md §9.1): real diagnostics
// from every producer validate against it unchanged.

vi.setConfig({ testTimeout: 30_000 });

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats.default(ajv);
const validate = ajv.compile(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../docs/schemas/diagnostic.v1.schema.json', import.meta.url)),
      'utf8',
    ),
  ) as object,
);
const conform = (diagnostics: readonly unknown[]) => {
  expect(diagnostics.length).toBeGreaterThan(0);
  for (const diagnostic of diagnostics)
    expect(
      validate(diagnostic),
      `${JSON.stringify(diagnostic)} ${ajv.errorsText(validate.errors)}`,
    ).toBe(true);
};

describe('existing diagnostic shapes conform to diagnostic.v1', () => {
  it('tokens', () => {
    conform(
      generate({ brand: { primary: 'not-a-colour' }, products: { Clinic: {} } } as never)
        .diagnostics,
    );
  });

  it('analyzer', () => {
    const fixture = fileURLToPath(
      new URL('../fixtures/analyzer-dynamic/tsconfig.json', import.meta.url),
    );
    conform(analyze({ project: fixture }).diagnostics);
  });

  it('model', () => {
    conform(
      NavigationItemModel.validate([
        { id: 'a', kind: 'link', label: 'A' },
        { id: 'a', kind: 'menu', label: 'B' },
      ]).diagnostics,
    );
  });

  it('Workbench', () => {
    conform(
      checkExamples(
        { component: 'Not A Tag', examples: { '1bad': { props: { nope: 1 } } } } as never,
        { properties: ['label'] },
      ),
    );
  });

  it('collections', () => {
    const items = collection<{ id?: string }>({ key: (item) => item.id });
    items.set([{ id: 'a' }, {}, { id: 'a' }]);
    conform(items.diagnostics.value);
  });
});
