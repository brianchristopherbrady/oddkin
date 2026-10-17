// Shared bundle-size measurement for the benchmark runner and the size-budget check.
// Production build (default export conditions), esbuild bundle + minify, ESM, es2022.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const ENTRIES = ['counter', 'component', 'list', 'reactive'];

/** Budgets in gzip bytes (ADR 0019). Measured 2026-10-17 in the comments. */
export const BUDGETS = {
  counter: 9728, // 9.5 KiB; measured 9,280
  component: 11264, // 11 KiB; measured 10,553
  list: 11776, // 11.5 KiB; measured 11,064
  reactive: 2048, // 2 KiB; measured 1,892
};

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
