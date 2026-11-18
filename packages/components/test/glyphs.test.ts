import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { checkCircleGlyph, infoGlyph, warningGlyph } from '../src/styles/glyphs.js';

// The glyph module keeps a promise (glyphs.ts): a bundle keeps only the glyphs it renders.
// Bundlers keep any tagged template at a module's top level, so each glyph is made through a call
// marked pure, which a bundler drops when its result is unused.
describe('glyphs', () => {
  it('a bundle keeps only the glyphs it imports', async () => {
    const result = await build({
      stdin: {
        contents: "export { copyGlyph } from './src/styles/glyphs.ts';",
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
        loader: 'ts',
      },
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
      external: ['@oddkin/*'],
      logLevel: 'silent',
    });
    const code = result.outputFiles[0]!.text;
    expect(code).toContain('M3 14H2V2h12v1');
    // The check (copied state) and the star are other glyphs of the same module.
    expect(code).not.toContain('M5 10.5l3.5 3.5L15 7');
    expect(code).not.toContain('M10 2l2.5 5');
  });

  // Figma's tone markers are the library icons; so are these (badge, alert, toast, status marker).
  it('draws the tone glyphs from the canonical icons in design/icons/general', () => {
    const icon = (name: string) =>
      readFileSync(new URL(`../../../design/icons/general/${name}.svg`, import.meta.url), 'utf8');
    const markup = (glyph: { strings: readonly string[] }) => glyph.strings.join('');
    const numbers = (text: string) => [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
    expect(icon('information')).toContain('a 8 8 0 1 0 16 0');
    expect(markup(infoGlyph)).toContain('r="8"');
    expect(icon('check-circle')).toContain('a 8.5 8.5 0 1 0 17 0');
    expect(markup(checkCircleGlyph)).toContain('r="8.5"');
    // The warning icon's triangle (apex, base right, base left x), its group transform applied.
    const warning = icon('warning');
    const [tx, ty, scale] = numbers(/translate\([^)]+\) scale\([^)]+\)/.exec(warning)![0]);
    const [ax, ay, rx, ry, lx] = numbers(/d="(M [^"]+ Z)"/.exec(warning)![1]!);
    const expected = [
      ax! * scale! + tx!,
      ay! * scale! + ty!,
      rx! * scale! + tx!,
      ry! * scale! + ty!,
      lx! * scale! + tx!,
    ];
    const drawn = numbers(/d="(M10 [^"]+z)"/.exec(markup(warningGlyph))![1]!);
    expect(drawn).toHaveLength(5);
    drawn.forEach((n, i) => expect(n, `point ${i}`).toBeCloseTo(expected[i]!, 1));
  });
});
