import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

interface Probe {
  class: string;
  properties: Array<Record<string, unknown>>;
  diagnostics: Array<{ code: string; where: string }>;
}

function probe(config: string): Probe[] {
  const out = execFileSync(
    process.execPath,
    ['scripts/experiments/analyzability-probe.mjs', config],
    { encoding: 'utf8' },
  );
  return JSON.parse(out) as Probe[];
}

describe('static analyzability of OddkinElement.with() (TypeScript 7 API)', () => {
  it('extracts complete property metadata from the core-counter example without executing it', () => {
    const [counter, greeting] = probe('examples/core-counter/tsconfig.json');
    expect(counter?.class).toBe('DemoCounter');
    expect(counter?.diagnostics).toEqual([]);
    expect(greeting?.properties).toEqual([
      {
        name: 'name',
        kind: 'string',
        type: 'string',
        attribute: 'name',
        reflect: false,
        default: 'world',
        description: 'Who to greet.',
      },
      {
        name: 'excited',
        kind: 'boolean',
        type: 'boolean',
        attribute: 'excited',
        reflect: true,
        description: 'Adds emphasis; reflected for styling.',
      },
      {
        name: 'tone',
        kind: 'enum',
        type: '"formal" | "plain" | "warm"',
        attribute: 'tone',
        reflect: true,
        values: ['plain', 'warm', 'formal'],
        default: 'plain',
      },
      {
        name: 'history',
        kind: 'array',
        type: 'string[]',
        attribute: null,
        reflect: false,
        description: 'Previous names (property only).',
      },
    ]);
  }, 30_000);

  it('reports dynamic definitions with locations instead of guessing, and never runs modules', () => {
    const [dynamic] = probe('tests/fixtures/analyzer-dynamic/tsconfig.json');
    expect(dynamic?.properties.map((p) => p['name'])).toEqual(['size', 'open']);
    expect(dynamic?.diagnostics).toEqual([
      { code: 'analyzer.dynamic.property', where: 'DynamicElement', kind: 'SpreadAssignment' },
      { code: 'analyzer.dynamic.property', where: 'DynamicElement', kind: 'PropertyAssignment' },
      {
        code: 'analyzer.dynamic.value',
        where: 'DynamicElement.size',
        kind: 'PropertyAccessExpression',
      },
    ]);
  }, 30_000);
});
