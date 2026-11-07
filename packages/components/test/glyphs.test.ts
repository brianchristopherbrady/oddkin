import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

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
});
