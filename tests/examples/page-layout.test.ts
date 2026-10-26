import { describe, expect, it } from 'vitest';
import { checkPages, EXCEPTIONS, findLayouts } from '../../scripts/check-page-layout.mjs';

// Contract: IMPLEMENTATION_PLAN.md M10 "Layout primitives in use where appropriate",
// layout-recipes.md §12–§13. The real pages are checked by `npm run lint:layout`; these cases
// prove the check catches what it claims to.
const pages = (files: Record<string, string>, exceptions = EXCEPTIONS) =>
  checkPages({ files: Object.keys(files), read: (file: string) => files[file]!, exceptions });

describe('page layout check', () => {
  it('finds flex and grid displays with their selectors in stylesheets, style blocks, and templates', () => {
    const css = `main {\n  display: grid;\n}\n@container wide (min-width: 40rem) {\n  .a, .b { gap: 1rem; display: inline-flex; }\n}`;
    expect(findLayouts(css)).toEqual([
      { selector: 'main', line: 2, declaration: 'display: grid' },
      { selector: '.a, .b', line: 5, declaration: 'display: inline-flex' },
    ]);
    expect(findLayouts('<style>html{margin:0;}[data-x]{display:grid;gap:1rem;}</style>')).toEqual([
      { selector: '[data-x]', line: 1, declaration: 'display:grid' },
    ]);
    expect(
      findLayouts('css`\n  /* Header */\n  .x .y {\n    display: flex;\n  }\n`')[0]?.selector,
    ).toBe('.x .y');
    expect(findLayouts('.a { display: block; } .b { display: contents; }')).toEqual([]);
  });

  it('fails on a hand-written page layout without a recorded reason', () => {
    const result = pages({ 'examples/new/styles.css': '.toolbar { display: flex; gap: 1rem; }' });
    expect(result.unlisted).toMatchObject([
      { file: 'examples/new/styles.css', selector: '.toolbar' },
    ]);
  });

  it('keeps a recorded exception by file and selector, or for a whole file', () => {
    const exceptions = [
      { file: 'a/styles.ts', selector: '.frame', reason: 'container-query shell' },
      { file: 'b/styles.css', selector: '*', reason: 'no component CSS' },
    ];
    const result = pages(
      {
        'a/styles.ts': '.frame { display: grid; } .row { display: flex; }',
        'b/styles.css': 'main { display: grid; } .panel { display: flex; }',
      },
      exceptions,
    );
    expect(result.findings.filter((f) => f.exception)).toHaveLength(3);
    expect(result.unlisted).toMatchObject([{ file: 'a/styles.ts', selector: '.row' }]);
    expect(result.stale).toEqual([]);
  });

  it('reports a recorded exception that no longer matches anything', () => {
    const exceptions = [{ file: 'a/styles.css', selector: '.gone', reason: 'old' }];
    expect(pages({ 'a/styles.css': '.kept { display: block; }' }, exceptions).stale).toEqual(
      exceptions,
    );
  });

  it('passes on the repository: every remaining page layout has its reason', () => {
    const result = checkPages();
    expect(result.files).toBeGreaterThan(30);
    expect(result.unlisted).toEqual([]);
    expect(result.stale).toEqual([]);
    for (const exception of EXCEPTIONS) expect(exception.reason.length).toBeGreaterThan(20);
  });
});
