// Shared bundle-size measurement for the benchmark runner and the size-budget check.
// Production build (default export conditions), esbuild bundle + minify, ESM, es2022.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const ENTRIES = ['counter', 'component', 'list', 'reactive'];

/** Budgets in gzip bytes (ADR 0019). Measured 2026-10-17 in the comments. */
export const BUDGETS = {
  counter: 9728, // 9.5 KiB; measured 9,280
  component: 11264, // 11 KiB; measured 10,553
  list: 11776, // 11.5 KiB; measured 11,064
  reactive: 2048, // 2 KiB; measured 1,892
};

/**
 * CSS budgets in gzip bytes (css-architecture.md §12). Measured 2026-10-17 in the comments:
 * the generated default theme and each component's combined structural and default styles.
 */
export const CSS_BUDGETS = {
  'tokens:default.css': 2048, // measured 1,827 (layered; 1,768 unlayered)
  'components:button': 1280, // measured 1,100
  'components:card': 640, // measured 571
  'components:input': 768, // measured 647
};

/** Gzip sizes of the shipped CSS: generated token CSS and component style modules. */
export async function measureCssSizes(root = fileURLToPath(new URL('../../..', import.meta.url))) {
  const sizes = {};
  const gzip = (text) => gzipSync(Buffer.from(text), { level: 9 }).length;
  sizes['tokens:default.css'] = gzip(
    readFileSync(join(root, 'packages/tokens/dist/css/default.css'), 'utf8'),
  );
  for (const name of ['button', 'card', 'input']) {
    const module = await import(
      pathToFileURL(join(root, `packages/components/dist/${name}/index.js`)).href
    );
    const text = Object.values(module)
      .filter((value) => typeof value?.cssText === 'string')
      .map((value) => value.cssText)
      .join('\n');
    sizes[`components:${name}`] = gzip(text);
  }
  return sizes;
}

export async function measureSizes(root = fileURLToPath(new URL('../../..', import.meta.url))) {
  const sizes = {};
  for (const entry of ENTRIES) {
    const result = await build({
      absWorkingDir: root,
      entryPoints: [`research/benchmarks/size/${entry}.ts`],
      bundle: true,
      minify: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      write: false,
      legalComments: 'none',
      metafile: true,
      logLevel: 'silent',
    });
    const code = result.outputFiles[0].contents;
    const inputs = Object.values(result.metafile.outputs)[0].inputs;
    sizes[entry] = {
      minified: code.length,
      gzip: gzipSync(code, { level: 9 }).length,
      brotli: brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      modules: Object.keys(inputs)
        .map((p) => p.replace(/\\/g, '/').replace(/^.*?packages\//, 'packages/'))
        .sort(),
    };
  }
  return sizes;
}
