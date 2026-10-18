import { describe, expect, it } from 'vitest';
import { highlight } from '../src/highlight/index.js';
import { parseBlocks, parseInline, splitBlocks } from '../src/markdown/parse.js';
import { toPlainText } from '../src/markdown/render.js';
import { safeUrl } from '../src/markdown/url.js';

const DOC = [
  '# Title',
  '',
  'Some **bold** and *em* text with `code`, a [link](https://example.com "T") and [^src-1].',
  '',
  '- one',
  '- two',
  '  - nested',
  '',
  '1. first',
  '2) second',
  '',
  '> quoted **text**',
  '',
  '| a | b |',
  '|:--|--:|',
  '| 1 | 2 |',
  '',
  '```ts',
  'const x = "```";',
  '```',
  '',
  '---',
  '',
  '<script>alert(1)</script>',
  '',
  'Line with  ',
  'hard break and ~~strike~~ and <https://auto.example> and https://bare.example/x.',
].join('\n');

describe('Markdown parser', () => {
  it('parses the supported dialect', () => {
    const blocks = parseBlocks(DOC);
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'list',
      'quote',
      'table',
      'code',
      'rule',
      'html',
      'paragraph',
    ]);
    const paragraph = blocks[1];
    expect(paragraph?.type === 'paragraph' && paragraph.children.map((c) => c.type)).toEqual([
      'text',
      'strong',
      'text',
      'em',
      'text',
      'code',
      'text',
      'link',
      'text',
      'citation',
      'text',
    ]);
    const list = blocks[2];
    expect(list?.type === 'list' && list.items[1]?.map((b) => b.type)).toEqual([
      'paragraph',
      'list',
    ]);
    const code = blocks[6];
    expect(code).toEqual({ type: 'code', lang: 'ts', text: 'const x = "```";', open: false });
    const table = blocks[5];
    expect(table?.type === 'table' && table.align).toEqual(['left', 'right']);
    const last = blocks[9];
    expect(last?.type === 'paragraph' && last.children.map((c) => c.type)).toEqual([
      'text',
      'break',
      'text',
      'del',
      'text',
      'link',
      'text',
      'link',
      'text',
    ]);
  });

  it('A13: any prefix parses; earlier block slices are final once later content exists', () => {
    const finalBlocks = splitBlocks(DOC);
    for (let i = 0; i <= DOC.length; i++) {
      const prefix = DOC.slice(0, i);
      expect(() => parseBlocks(prefix, { repair: true })).not.toThrow();
      const slices = splitBlocks(prefix);
      // Every slice but the last equals the slice at the same index in the final document.
      slices.slice(0, -1).forEach((slice, k) => expect(slice).toBe(finalBlocks[k]));
    }
    expect(toPlainText(DOC)).toContain('const x = "```";');
  });

  it('repairs incomplete syntax for display only', () => {
    expect(parseInline('Some **bol', { repair: true })).toEqual([
      { type: 'text', text: 'Some bol' },
    ]);
    expect(parseInline('Some **bol')).toEqual([{ type: 'text', text: 'Some **bol' }]);
    expect(parseInline('see [the docs](https://exa', { repair: true })).toEqual([
      { type: 'text', text: 'see the docs' },
    ]);
    expect(parseInline('run `npm i', { repair: true })).toEqual([
      { type: 'text', text: 'run ' },
      { type: 'code', text: 'npm i' },
    ]);
    expect(parseBlocks('```js\nlet a', { repair: true })).toEqual([
      { type: 'code', lang: 'js', text: 'let a', open: true },
    ]);
  });

  it('keeps literal text for underscores inside words and escapes', () => {
    expect(parseInline('snake_case_name and \\*not em\\*')).toEqual([
      { type: 'text', text: 'snake_case_name and *not em*' },
    ]);
  });
});

describe('URL policy', () => {
  it('A14: allows only listed schemes; relative only when enabled', () => {
    for (const bad of [
      'javascript:alert(1)',
      ' JaVaScRiPt:x',
      'java\tscript:x',
      'data:text/html,x',
      'vbscript:x',
      '//evil.example',
      '/relative',
      'file:///etc/passwd',
    ])
      expect(safeUrl(bad), bad).toBeUndefined();
    expect(safeUrl('https://example.com/a b')).toBe('https://example.com/a%20b');
    expect(safeUrl('mailto:a@example.com')).toBe('mailto:a@example.com');
    expect(
      safeUrl('/docs', {
        protocols: ['https:'],
        allowRelative: true,
        base: 'https://site.example',
      }),
    ).toBe('https://site.example/docs');
  });
});

describe('highlighter', () => {
  it('returns tokens that reproduce the code exactly, never markup', () => {
    const code = 'const s = "<img onerror=x>"; // note\nlet n = 42;';
    const tokens = highlight(code, 'ts') ?? [];
    expect(tokens.map((t) => t.text).join('')).toBe(code);
    expect(tokens.find((t) => t.kind === 'string')?.text).toBe('"<img onerror=x>"');
    expect(tokens.filter((t) => t.kind === 'keyword').map((t) => t.text)).toEqual(['const', 'let']);
    expect(highlight('x', 'brainfuck')).toBeUndefined();
  });
});
