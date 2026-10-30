import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { extractExamples } from '../src/examples.js';

// Example values recorded by parsing (never executing), so a published package carries them
// without its sources. Each must equal what toExamplesJSON() gives at run time: the example
// without its fixture through JSON, and `hasFixture` when it has one.
const dir = mkdtempSync(join(tmpdir(), 'oddkin-example-values-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function definitions(source: string) {
  const file = join(dir, 'x.examples.ts');
  writeFileSync(file, `import { defineExamples } from '@oddkin/workbench/examples';\n${source}`);
  const { examples } = extractExamples([file], dir);
  return Object.fromEntries(examples.map((e) => [e.name, e.definition]));
}

/** toExamplesJSON()'s serialization of one example (packages/workbench/src/examples). */
function serialized({ fixture, ...rest }: Record<string, unknown>) {
  return {
    ...(JSON.parse(JSON.stringify(rest)) as object),
    ...(fixture ? { hasFixture: true } : {}),
  };
}

describe('example values', () => {
  it('records literals, constants, templates, spreads, and JSON.stringify() as toExamplesJSON does', () => {
    const items = [
      { label: 'Home', href: '#home' },
      { label: 'Docs', href: '#docs' },
    ];
    const base = { size: 'sm', hidden: undefined };
    expect(
      definitions(`
const items = [
  { label: 'Home', href: '#home' },
  { label: 'Docs', href: '#docs' },
];
const labels = ['Home', 'Docs'] as const;
const base = { size: 'sm', hidden: undefined };
const count = 2;
export default defineExamples('x-list', {
  literal: {
    label: 'Literal',
    props: { count: -2, ratio: 0.5, open: true, none: null, gone: undefined },
    attributes: { tone: 'info', off: null },
    slots: { default: \`Two
lines\` },
    preset: true,
  },
  constants: {
    props: { items, ...base, list: [...labels, undefined] },
    attributes: { items: JSON.stringify(items) },
    slots: { default: \`\${count} items, \${labels}\` },
  },
  withFixture: { slots: { default: 'Set up' }, fixture() {} },
});`),
    ).toStrictEqual({
      literal: serialized({
        label: 'Literal',
        props: { count: -2, ratio: 0.5, open: true, none: null, gone: undefined },
        attributes: { tone: 'info', off: null },
        slots: { default: 'Two\nlines' },
        preset: true,
      }),
      constants: serialized({
        props: { items, ...base, list: [...items.map((item) => item.label), undefined] },
        attributes: { items: JSON.stringify(items) },
        slots: { default: `${items.length} items, ${items.map((item) => item.label)}` },
      }),
      withFixture: serialized({ slots: { default: 'Set up' }, fixture: () => {} }),
    });
  });

  it('records nothing for an example with a computed value', () => {
    expect(
      definitions(`
import { icon } from './icons.js';
let mutable = 'a';
const self = { again: self };
const size = 'sm';
export default defineExamples('x-list', {
  imported: { props: { icon } },
  call: { slots: { default: 'a'.repeat(2) } },
  conditional: { slots: { default: size === 'sm' ? 'Small' : 'Large' } },
  reassignable: { slots: { default: mutable } },
  cycle: { props: { self } },
  method: { props: { format() { return ''; } } },
  spread: { ...{ label: 'Spread' } },
  kept: { label: 'Kept', props: { size } },
});`),
    ).toEqual({
      imported: undefined,
      call: undefined,
      conditional: undefined,
      reassignable: undefined,
      cycle: undefined,
      method: undefined,
      spread: undefined,
      kept: { label: 'Kept', props: { size: 'sm' } },
    });
  });

  it('keeps a __proto__ key as an ordinary property, as JSON does', () => {
    const value = definitions(
      `export default defineExamples('x-list', { odd: { props: { ['__proto__']: { polluted: true } } } });`,
    )['odd'] as { props: object };
    expect(Object.getPrototypeOf(value.props)).toBe(Object.prototype);
    expect(Object.keys(value.props)).toEqual(['__proto__']);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
