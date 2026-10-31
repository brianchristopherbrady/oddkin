import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHANGE, applyEdits } from '../../scripts/impact-demo.mjs';

// The change-impact demonstration (scripts/impact-demo.mjs) edits this checkout's sources by exact
// text. When those sources move on, this fails here instead of in the next demonstration run.
describe('the change-impact demonstration', () => {
  it('applies to this checkout: each edit matches exactly once, in order', () => {
    const texts = new Map<string, string>();
    for (const { edits } of CHANGE)
      for (const [file, text] of applyEdits(
        (path) => texts.get(path) ?? readFileSync(path, 'utf8'),
        edits,
      ))
        texts.set(file, text);
    expect([...texts.keys()].sort()).toEqual([
      'packages/components/src/menu/menu.template.ts',
      'packages/components/src/menu/menu.ts',
      'packages/tokens/themes/default.theme.json',
    ]);
    expect(texts.get('packages/components/src/menu/menu.template.ts')).not.toContain('part="item"');
  });

  it('refuses an edit that does not match exactly once', () => {
    expect(() => applyEdits(() => 'a a', [{ file: 'x.ts', find: 'a', replace: 'b' }])).toThrow(
      /x\.ts holds 2 copies of "a", not 1/,
    );
    expect(() => applyEdits(() => 'a', [{ file: 'x.ts', find: 'c', replace: 'b' }])).toThrow(
      /holds 0 copies/,
    );
  });
});
