import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buttonConformance } from '../src/conformance/button.js';
import {
  checkConformance,
  defineConformance,
  toConformanceJSON,
  type ConformanceSuite,
} from '../src/conformance/index.js';

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../docs/schemas/${path}`, import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats.default(ajv);
const validate = ajv.compile(read('conformance.v1.schema.json') as object);

const base: ConformanceSuite = {
  id: 'acme.toggle',
  version: '1.0.0',
  contract: { component: 'component:acme-toggle', versions: '^1.0.0' },
  requires: {},
  cases: [{ id: 'a', title: 'A', kind: 'assertion', run: () => {} }],
};

describe('conformance contracts (DOM-free)', () => {
  it('the button suite serializes to valid conformance.v1 matching the committed example', () => {
    const json = toConformanceJSON(buttonConformance);
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    expect(json).toEqual(read('examples/conformance.valid.json'));
  });

  it('defineConformance freezes the suite and its cases', () => {
    const suite = defineConformance(base);
    expect(Object.isFrozen(suite)).toBe(true);
    expect(Object.isFrozen(suite.cases)).toBe(true);
    expect(checkConformance(suite)).toEqual([]);
  });

  it('reports structural problems with stable codes and paths', () => {
    const run = () => {};
    const problems = checkConformance({
      ...base,
      id: 'Bad Id',
      version: 'one',
      contract: { component: 'acme-toggle', versions: '*' },
      cases: [
        { id: 'x', title: 'X', kind: 'invariant', run },
        { id: 'x', title: 'X again', kind: 'assertion', change: 'reconnect', run },
      ],
    });
    expect(problems.map((p) => [p.code, p.path])).toEqual([
      ['conformance.id.invalid', '/id'],
      ['conformance.version.invalid', '/version'],
      ['conformance.contract.invalid', '/contract/component'],
      ['conformance.invariant.change', '/cases/0'],
      ['conformance.case.duplicate', '/cases/1'],
      ['conformance.assertion.change', '/cases/1'],
    ]);
  });
});
