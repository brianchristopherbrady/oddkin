import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  compareSnapshots,
  createSnapshot,
  renderImpactMarkdown,
  type BaselineResult,
  type ImpactReport,
} from '../src/impact.js';
import { clone, library, type LibraryInputs } from './impact.fixture.js';

// Known answers (change-impact-and-verification.md §6): each expected selection below is written
// out from the fixture's documented dependencies, not computed by the code under test. Equality
// means no missed dependency and no extra selection.

const schema = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../../../docs/schemas/${name}.v1.schema.json`, import.meta.url), 'utf8'),
  ) as object;
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
addFormats.default(ajv);
const validSnapshot = ajv.compile(schema('comparison-snapshot'));
const validReport = ajv.compile(schema('impact-report'));

function impact(
  products: number,
  edit: (head: LibraryInputs) => void,
  options: { baseline?: BaselineResult[]; both?: (inputs: LibraryInputs) => void } = {},
): ImpactReport {
  const base = library(products);
  options.both?.(base);
  const head = clone(base);
  edit(head);
  const before = createSnapshot(base);
  const after = createSnapshot(head);
  expect(validSnapshot(after), JSON.stringify(validSnapshot.errors)).toBe(true);
  const report = compareSnapshots(
    before,
    after,
    options.baseline ? { baseline: options.baseline } : {},
  );
  expect(validReport(report), JSON.stringify(validReport.errors)).toBe(true);
  return report;
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const products = (n: number) =>
  ids(n)
    .map((p) => `product:${p}`)
    .sort();
const selected = (report: ImpactReport) =>
  report.checks
    .filter((c) => c.state === 'selected')
    .map((c) => `${c.id}@${c.product}`)
    .sort();
/** Checks per product, from a hand-written rule. */
const expectChecks = (n: number, rule: (product: string) => string[]) =>
  ids(n)
    .flatMap((p) => rule(p).map((check) => `${check}@${p}`))
    .sort();

const BUTTON = ['example:acme-button/default', 'example:acme-button/primary'];
const QUIET = ['example:acme-quiet-button/default'];
const CARD = ['example:acme-card/default', 'example:acme-card/withAction'];
/** Renders an acme-button in its fixture, so anything affecting the button selects it. */
const USES_BUTTON = ['example:acme-card/withAction'];
const FIELD = ['example:acme-field/default'];
const DIALOG = ['example:acme-dialog/default'];
const SUITE_BUTTON = ['suite:oddkin.button#acme-button'];
const SUITE_QUIET = ['suite:oddkin.button#acme-quiet-button'];
/** p3 applies to acme-button and acme-card only. */
const only = (p: string, checks: string[]) =>
  p === 'p3'
    ? checks.filter((c) => /acme-(button|card)\b/.test(c) && !c.includes('quiet'))
    : checks;

const brand = (head: LibraryInputs, token: string, value: string) => {
  const entry = head.theme!.inspection.tokens.find((t) => t.name === token)!;
  Object.assign(entry, { definition: value, value });
};
const edit = (head: LibraryInputs, module: string) => {
  head.packages[0]!.modules![module] += '// edited\n';
};

describe.each([1, 2, 3, 10])('change impact with %i product(s)', (n) => {
  it('a token value change selects what reads it, in every product that does not set it', () => {
    const report = impact(n, (head) => brand(head, 'color.surface', '#fafafa'));
    expect(report.changes.map((c) => [c.id, c.change, c.classification])).toEqual([
      ['token:color.surface', 'changed', 'review'],
    ]);
    expect(selected(report)).toEqual(
      expectChecks(n, (p) => only(p, [...CARD, ...FIELD, ...DIALOG])),
    );
    expect(report.affected.products.map((a) => a.id)).toEqual(products(n));
  });

  it('a token unit change is incompatible; a product that sets the alias keeps its own value', () => {
    const report = impact(n, (head) => {
      brand(head, 'radius.base', '0.25rem');
      for (const alias of ['radius.control', 'radius.surface'])
        Object.assign(
          head.theme!.inspection.tokens.find((t) => t.name === alias)!,
          { value: '0.25rem' },
        );
    });
    expect(report.changes.map((c) => [c.id, c.classification, c.reason])).toEqual([
      ['token:radius.base', 'incompatible', 'unit changed from px to rem'],
      ['token:radius.control', 'incompatible', 'unit changed from px to rem'],
      ['token:radius.surface', 'incompatible', 'unit changed from px to rem'],
    ]);
    // p2 overrides radius.control: only the card, through radius.surface, is affected there.
    expect(selected(report)).toEqual(
      expectChecks(n, (p) =>
        p === 'p2'
          ? CARD
          : only(p, [
              ...BUTTON,
              ...QUIET,
              ...CARD,
              ...FIELD,
              ...DIALOG,
              ...SUITE_BUTTON,
              ...SUITE_QUIET,
            ]),
      ),
    );
  });

  it('a shared structural-style change selects every definition composed with it and their dependents', () => {
    const report = impact(n, (head) => edit(head, 'dist/button/button.structural.styles.js'));
    expect(report.changes.map((c) => c.id)).toEqual([
      'style:@acme/ui/dist/button/button.structural.styles.js#buttonStructuralStyles',
    ]);
    expect(selected(report)).toEqual(
      expectChecks(n, (p) =>
        only(p, [...BUTTON, ...QUIET, ...DIALOG, ...SUITE_BUTTON, ...SUITE_QUIET, ...USES_BUTTON]),
      ),
    );
  });

  it('a foundation template change reaches the derived definition that reuses it', () => {
    const report = impact(n, (head) => edit(head, 'dist/button/button.template.js'));
    expect(report.changes.map((c) => [c.id, c.classification])).toEqual([
      ['template:@acme/ui/dist/button/button.template.js#buttonTemplate', 'review'],
    ]);
    expect(selected(report)).toEqual(
      expectChecks(n, (p) =>
        only(p, [...BUTTON, ...QUIET, ...DIALOG, ...SUITE_BUTTON, ...SUITE_QUIET, ...USES_BUTTON]),
      ),
    );
  });

  it('a foundation skin change does not reach a derived definition with its own skin', () => {
    const report = impact(n, (head) => edit(head, 'dist/button/button.styles.js'));
    expect(selected(report)).toEqual(
      expectChecks(n, (p) => only(p, [...BUTTON, ...DIALOG, ...SUITE_BUTTON, ...USES_BUTTON])),
    );
  });

  it('a product-only override selects only that product', () => {
    const report = impact(n, (head) => {
      (head.theme!.config!['products'] as Record<string, object>)['p1'] = {
        brand: { primary: '#aa3300' },
      };
    });
    expect(report.changes.map((c) => c.id)).toEqual(['theme:product/p1']);
    // p1 sets color.brand; color.action follows it into the button skin and the dialog.
    expect(selected(report)).toEqual(
      expectChecks(n, (p) =>
        p === 'p1' ? [...BUTTON, ...DIALOG, ...SUITE_BUTTON, ...USES_BUTTON] : [],
      ),
    );
    expect(report.affected.products.map((a) => a.id)).toEqual(['product:p1']);
  });

  it('a dynamic dependency widens selection to every example of the package', () => {
    const report = impact(n, (head) => {
      head.packages[0]!.metadata.diagnostics = [
        { code: 'analyzer.dynamic.property', source: { file: 'src/card/card.ts', line: 12 } },
      ];
      edit(head, 'dist/card/card.styles.js');
    });
    expect(report.coverageGaps).toEqual([
      { item: 'package:@acme/ui', reason: 'analyzer.dynamic.property at src/card/card.ts:12' },
    ]);
    expect(selected(report)).toEqual(
      expectChecks(n, (p) => only(p, [...BUTTON, ...QUIET, ...CARD, ...FIELD, ...DIALOG])),
    );
  });

  it('an unresolved token read widens selection too, but only when the package is affected', () => {
    const unresolved = (inputs: LibraryInputs) => {
      inputs.packages[0]!.metadata.styles!['dist/field/field.styles.js#fieldStyles'] = {
        tokens: ['color.surface', '--odd-color-missing'],
      };
    };
    // Present in both revisions: an unchanged package selects nothing.
    expect(selected(impact(n, () => {}, { both: unresolved }))).toEqual([]);
    const report = impact(n, (head) => edit(head, 'dist/card/card.styles.js'), {
      both: unresolved,
    });
    expect(report.coverageGaps).toContainEqual({
      item: 'style:@acme/ui/dist/field/field.styles.js#fieldStyles',
      reason:
        'reads --odd-color-missing, which is neither a token nor a declared component variable',
    });
    expect(selected(report)).toEqual(
      expectChecks(n, (p) => only(p, [...BUTTON, ...QUIET, ...CARD, ...FIELD, ...DIALOG])),
    );
  });

  const renameRadius = (head: LibraryInputs) => {
    const tokens = head.theme!.inspection.tokens as {
      name: string;
      cssVariable?: string;
      definition: unknown;
    }[];
    Object.assign(
      tokens.find((t) => t.name === 'radius.base')!,
      {
        name: 'radius.root',
        cssVariable: '--odd-radius-root',
      },
    );
    for (const alias of ['radius.control', 'radius.surface'])
      Object.assign(
        tokens.find((t) => t.name === alias)!,
        { definition: '{radius.root}' },
      );
  };
  const radiusChecks = (p: string) =>
    p === 'p2'
      ? CARD
      : only(p, [
          ...BUTTON,
          ...QUIET,
          ...CARD,
          ...FIELD,
          ...DIALOG,
          ...SUITE_BUTTON,
          ...SUITE_QUIET,
        ]);

  it('a renamed token without a migration record is a removal and an addition, never a match', () => {
    const report = impact(n, renameRadius);
    expect(report.changes.map((c) => [c.id, c.change, c.classification, c.possibleRename])).toEqual(
      [
        ['token:radius.base', 'removed', 'incompatible', 'token:radius.root'],
        ['token:radius.control', 'changed', 'review', undefined],
        ['token:radius.root', 'added', 'informational', undefined],
        ['token:radius.surface', 'changed', 'review', undefined],
      ],
    );
    expect(selected(report)).toEqual(expectChecks(n, radiusChecks));
  });

  it('a renamed token with a migration record is reported as a rename', () => {
    const migration = {
      from: 'token:radius.base',
      to: 'token:radius.root',
      source: 'migrations/1.1.md',
    };
    const report = impact(n, (head) => {
      renameRadius(head);
      head.migrations = [migration];
    });
    expect(report.changes.map((c) => [c.id, c.change, c.from, c.migration])).toEqual([
      ['token:radius.control', 'changed', undefined, undefined],
      ['token:radius.root', 'renamed', 'token:radius.base', 'migrations/1.1.md'],
      ['token:radius.surface', 'changed', undefined, undefined],
    ]);
    expect(report.changes.find((c) => c.change === 'renamed')?.classification).toBe('incompatible');
    expect(selected(report)).toEqual(expectChecks(n, radiusChecks));
  });
});

describe('change impact states and fallbacks', () => {
  const conditions = { browsers: ['chromium 156', 'firefox 157', 'webkit 26'], inputs: 'sha256-…' };
  const everyCheck = (n: number): BaselineResult[] =>
    ids(n).flatMap((product) =>
      only(product, [
        ...BUTTON,
        ...QUIET,
        ...CARD,
        ...FIELD,
        ...DIALOG,
        ...SUITE_BUTTON,
        ...SUITE_QUIET,
      ]).map((check) => ({ check, product, state: 'passed' as const, conditions })),
    );

  it('reuses a result only from a passing baseline, listing its conditions', () => {
    const baseline = everyCheck(2)
      .filter((r) => !(r.check === 'example:acme-button/primary' && r.product === 'p2'))
      .map((r) =>
        r.check === 'example:acme-button/default' && r.product === 'p2'
          ? { ...r, state: 'failed' as const }
          : r,
      );
    const report = impact(2, (head) => brand(head, 'color.surface', '#fafafa'), { baseline });
    const state = (check: string, product: string) =>
      report.checks.find((c) => c.id === check && c.product === product);
    expect(state('example:acme-card/default', 'p1')).toMatchObject({ state: 'selected' });
    expect(state('example:acme-quiet-button/default', 'p1')).toEqual({
      id: 'example:acme-quiet-button/default',
      product: 'p1',
      state: 'reused',
      reason: 'no input on its path changed',
      conditions,
    });
    expect(state('example:acme-button/primary', 'p2')).toMatchObject({
      state: 'selected',
      reason: 'no baseline result',
    });
    expect(state('example:acme-button/default', 'p2')).toMatchObject({
      state: 'selected',
      reason: 'the baseline result failed',
    });
    expect(
      report.checks.filter((c) => c.state === 'reused').every((c) => c.conditions === conditions),
    ).toBe(true);
    // Every check ends in exactly one state.
    const keys = report.checks.map((c) => `${c.id}@${c.product}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(everyCheck(2).length);
  });

  it('a token type change is incompatible', () => {
    const report = impact(2, (head) => {
      Object.assign(
        head.theme!.inspection.tokens.find((t) => t.name === 'color.text')!,
        {
          type: 'dimension',
        },
      );
    });
    expect(report.changes).toEqual([
      {
        id: 'token:color.text',
        kind: 'token',
        change: 'changed',
        classification: 'incompatible',
        reason: 'type changed from color to dimension',
      },
    ]);
    // color.text is read through --odd-color-text by the quiet button's skin only; the button
    // suite targets the quiet button too.
    expect(selected(report)).toEqual(expectChecks(2, () => [...QUIET, ...SUITE_QUIET]));
  });

  it('a generator version change falls back to full verification without reuse', () => {
    const report = impact(
      3,
      (head) => {
        head.versions = { ...head.versions, generator: '0.2.0' };
      },
      { baseline: everyCheck(3) },
    );
    expect(report.fallback).toEqual({
      kind: 'full',
      reasons: ['generator version changed (0.1.0 → 0.2.0)'],
    });
    expect(report.checks.every((c) => c.state === 'selected')).toBe(true);
    expect(selected(report)).toEqual(
      everyCheck(3)
        .map((r) => `${r.check}@${r.product}`)
        .sort(),
    );
  });

  it('snapshots with different schema majors are not compared item by item', () => {
    const base = createSnapshot(library(1));
    const head = {
      ...createSnapshot(library(1)),
      schema: 'https://oddkin.dev/schemas/comparison-snapshot/v2.json',
    };
    const report = compareSnapshots(base, head as never);
    expect(report.fallback?.reasons[0]).toMatch(/^snapshot schemas differ/);
    expect(selected(report).length).toBe(everyCheck(1).length);
  });

  it('classifies API changes: removed and narrowed are incompatible, widened and documentation are not', () => {
    const report = impact(1, (head) => {
      const button = head.packages[0]!.manifest.modules[0]!.declarations![0]! as {
        members: { name: string; type: { text: string }; description?: string }[];
        attributes: { name: string; type: { text: string } }[];
        cssParts: unknown[];
      };
      button.members[0]!.type.text = '"primary"';
      button.attributes[0]!.type.text = '"primary" | "secondary" | "ghost"';
      button.members[1]!.description = 'Reworded.';
      button.cssParts = [];
    });
    expect(report.changes.map((c) => [c.id, c.change, c.classification, c.reason])).toEqual([
      [
        'attribute:acme-button#appearance',
        'changed',
        'review',
        'type widened to "primary" | "secondary" | "ghost"',
      ],
      ['part:acme-button#control', 'removed', 'incompatible', 'removed'],
      [
        'property:acme-button#appearance',
        'changed',
        'incompatible',
        'type narrowed from "primary" | "secondary" to "primary"',
      ],
      ['property:acme-button#disabled', 'changed', 'informational', 'documentation only'],
    ]);
  });

  it('never selects an explained mistake, and renders Markdown', () => {
    const report = impact(1, (head) => edit(head, 'dist/button/button.styles.js'));
    expect(report.checks.some((c) => c.id.includes('disabledFalse'))).toBe(false);
    const markdown = renderImpactMarkdown(report);
    expect(markdown).toContain('# Change impact');
    expect(markdown).toContain(
      '| review | changed | `style:@acme/ui/dist/button/button.styles.js#buttonStyles` |',
    );
    expect(markdown).toContain('| selected | `example:acme-dialog/default` | p1 |');
    expect(markdown).toContain('`definition:acme-dialog`');
  });
});
