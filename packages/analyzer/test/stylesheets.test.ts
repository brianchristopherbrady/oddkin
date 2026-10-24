import { describe, expect, it } from 'vitest';
import { stylesheetDocs, stylesheetRecords } from '../src/index.js';

describe('document stylesheets', () => {
  it('records the classes it defines, the tokens it reads, and the author variables', () => {
    const records = stylesheetRecords(
      [
        {
          name: 'stack',
          import: '@x/c/css/stack.css',
          layer: 'odd.layout',
          css: `/* .odd-quoted is only mentioned */
            .odd-stack { gap: var(--odd-stack-gap, var(--odd-space-md)); }
            .odd-stack > .odd-stack-item, .other { color: var( --odd-color-text ); }`,
          description: 'Stacks.',
          source: { file: 'src/css/index.ts', line: 3 },
        },
        { name: 'reset', import: '@x/c/css/reset.css', layer: 'odd.reset', css: '*{margin:0}' },
      ],
      'odd-',
      new Map([
        ['--odd-space-md', 'space.md'],
        ['--odd-color-text', 'color.text'],
      ]),
    );
    expect(Object.keys(records)).toEqual(['stylesheet:reset', 'stylesheet:stack']);
    expect(records['stylesheet:stack']).toEqual({
      name: 'stack',
      import: '@x/c/css/stack.css',
      layer: 'odd.layout',
      description: 'Stacks.',
      classes: ['odd-stack', 'odd-stack-item'],
      tokens: ['color.text', 'space.md'],
      variables: ['--odd-stack-gap'],
      source: { file: 'src/css/index.ts', line: 3 },
    });
    expect(records['stylesheet:reset']).toStrictEqual({
      name: 'reset',
      import: '@x/c/css/reset.css',
      layer: 'odd.reset',
      classes: [],
      tokens: [],
      variables: [],
    });
  });

  it("reads each map key's documentation from its constant", () => {
    const docs = stylesheetDocs(
      `import { css } from 'x';
/** The reset. */
export const reset = css\`\`;

/**
 * Avatar
 *   group.
 * @internal
 */
export const avatarGroup = css\`\`;
export const plain = css\`\`;
export const documentStylesheets = { reset, 'avatar-group': avatarGroup, plain, missing } as const;`,
      'index.ts',
    );
    expect([...docs]).toEqual([
      ['reset', { description: 'The reset.', line: 3 }],
      ['avatar-group', { description: 'Avatar group.', line: 10 }],
      ['plain', { line: 11 }],
    ]);
    expect(stylesheetDocs('export const other = {};', 'x.ts').size).toBe(0);
  });
});
