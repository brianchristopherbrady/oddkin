// Helper size for each composite candidate: `node research/experiments/composite/measure.mjs`.
// Bundled with esbuild (minified, ESM, every @oddkin/* import external), then gzip level 9.
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const here = new URL('.', import.meta.url);
for (const [name, file] of [
  ['element-reference parts (tag.ts)', 'tag.ts'],
  ['child directive (child.ts)', 'child.ts'],
]) {
  const result = await build({
    entryPoints: [new URL(file, here).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    external: ['@oddkin/*'],
  });
  const code = result.outputFiles[0].contents;
  console.log(`${name}: ${gzipSync(code, { level: 9 }).length} B gzip (${code.length} B minified)`);
}
console.log('family-specific template factories: 0 B (no helper; one literal template per family)');
