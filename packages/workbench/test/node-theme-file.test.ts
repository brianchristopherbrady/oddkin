import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { diffLines, fileVersion, formatThemeFile } from '../src/node/theme-file.js';

const shipped = readFileSync('packages/tokens/themes/default.theme.json', 'utf8');

describe('saving a theme file', () => {
  it("writes the draft in the file's own layout, so the diff shows only what changed", () => {
    const model = JSON.parse(shipped) as {
      overrides: Record<string, unknown>;
      spacing?: unknown;
    };
    expect(formatThemeFile(shipped, model)).toBe(shipped);
    (model.overrides['color.action.default'] as { light: string }).light = '#0a7d33';
    model.overrides['color.new'] = { light: '#111111', dark: '#eeeeee' };
    model.spacing = { strategy: 'ratio', ratio: 1.25, steps: [1, 2], snap: { unit: '4px' } };
    const next = formatThemeFile(shipped, model);
    // An edited entry stays on its line; new scalar objects that fit go on one line, others open.
    expect(next).toContain(
      '    "color.action.default": { "light": "#0a7d33", "dark": "#b4a8ff" },\n',
    );
    expect(next).toContain('    "color.new": { "light": "#111111", "dark": "#eeeeee" }\n');
    expect(next).toContain(
      '  "spacing": {\n    "strategy": "ratio",\n    "ratio": 1.25,\n    "steps": [1, 2],\n    "snap": { "unit": "4px" }\n  }\n}\n',
    );
    expect(JSON.parse(next)).toEqual(model);
  });

  it('keeps the indentation, line ending, and final newline it finds', () => {
    const tabs = '{\r\n\t"name": "x",\r\n\t"brand": {\r\n\t\t"primary": "#123"\r\n\t}\r\n}';
    expect(formatThemeFile(tabs, { name: 'y', brand: { primary: '#123' } })).toBe(
      '{\r\n\t"name": "y",\r\n\t"brand": {\r\n\t\t"primary": "#123"\r\n\t}\r\n}',
    );
    // Text that does not parse keeps the layout read before the error, and the rest is new.
    expect(formatThemeFile('{ broken', { a: { b: 1 }, c: [] })).toBe(
      '{\n  "a": { "b": 1 },\n  "c": []\n}',
    );
    expect(formatThemeFile('{\n "a": {\n  "b": 1\n },\n "c": [', { a: { b: 1 }, c: [] })).toBe(
      '{\n "a": {\n  "b": 1\n },\n "c": []\n}',
    );
    expect(formatThemeFile('', { a: 1 })).toBe('{\n  "a": 1\n}\n');
    // A new object goes on one line only if it holds only values and fits in 80 columns, the
    // comma that may follow it included.
    const wide = (n: number) => formatThemeFile('{}\n', { wide: { key: 'x'.repeat(n) } });
    expect(wide(56)).toBe(`{\n  "wide": { "key": "${'x'.repeat(56)}" }\n}\n`);
    expect(wide(57)).toBe(`{\n  "wide": {\n    "key": "${'x'.repeat(57)}"\n  }\n}\n`);
    expect(formatThemeFile('{}\n', { a: { b: { c: 1 } } })).toBe(
      '{\n  "a": {\n    "b": { "c": 1 }\n  }\n}\n',
    );
  });

  it('diffs by line, with context, hunk headers, and removals before additions', () => {
    const before = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n';
    expect(diffLines(before, before)).toEqual([]);
    expect(diffLines(before, before.replace('b', 'B').replace('j', 'J'), 1)).toEqual([
      '@@ -1,3 +1,3 @@',
      ' a',
      '-b',
      '+B',
      ' c',
      '@@ -9,2 +9,2 @@',
      ' i',
      '-j',
      '+J',
    ]);
    // Changes closer than twice the context share one hunk; CRLF and LF lines compare equal.
    expect(diffLines('a\r\nb\r\nc\r\nd\r\n', 'a\nB\nc\nD\n', 1)).toEqual([
      '@@ -1,4 +1,4 @@',
      ' a',
      '-b',
      '+B',
      ' c',
      '-d',
      '+D',
    ]);
    expect(diffLines('a\n', 'a\nb\n')).toEqual(['@@ -1,1 +1,2 @@', ' a', '+b']);
  });

  it('names each content of the file', () => {
    expect(fileVersion(shipped)).toMatch(/^[0-9a-f]{16}$/);
    expect(fileVersion(shipped)).toBe(fileVersion(`${shipped}`));
    expect(fileVersion(`${shipped} `)).not.toBe(fileVersion(shipped));
  });
});
