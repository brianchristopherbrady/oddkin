// Shared bundle-size measurement for the benchmark runner and the size-budget check.
// Production build (default export conditions), esbuild bundle + minify, ESM, es2022.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const ENTRIES = [
  'counter',
  'component',
  'list',
  'reactive',
  'ai-headless',
  'ai-response',
  'ai-chat',
  'side-nav',
  'store',
  'context',
  'persist',
];

/** Budgets in gzip bytes (ADR 0019). Measured 2026-10-17 in the comments. */
export const BUDGETS = {
  counter: 9728, // 9.5 KiB; measured 9,280
  component: 11264, // 11 KiB; measured 10,553
  list: 11776, // 11.5 KiB; measured 11,064
  reactive: 2048, // 2 KiB; measured 1,892
  'ai-headless': 14336, // 14 KiB; measured 13,391 on 2026-10-18 (controller + contracts + core model validation)
  'ai-response': 21504, // 21 KiB; measured 20,607 (one registered odd-response with Markdown and citations)
  // 49 KiB; measured 48,782 on 2026-10-18 (odd-conversation + odd-prompt-input, all nested
  // elements; +625 B since the shared core focus, announce, and observe controllers replaced
  // AI-internal helpers and recover focus after removal too).
  'ai-chat': 50176,
  // 16 KiB; measured 15,715 on 2026-10-18 (registered odd-side-nav with keyed repeat, project
  // item kinds, and the shared core FocusRecovery controller (+374 B); the recipe CSS is
  // extracted at build time, so the recipe engine (3.4 KiB) is not loaded). Was 15 KiB.
  'side-nav': 16384,
  // 2.5 KiB; measured 2,214 on 2026-10-19 (@oddkin/state/store: createStore, select, action, and
  // frozen snapshots over the reactive graph and diagnostics; no DOM module).
  store: 2560,
  // 4 KiB; measured 3,699 on 2026-10-19 (@oddkin/state/context: a provider and a consumer with
  // the community context protocol events, over the reactive graph, Scope, and diagnostics).
  context: 4096,
  // 3.25 KiB; measured 3,028 on 2026-10-19 (@oddkin/state/persist with the store it follows:
  // versioned envelope, migrations, validation, and storage-failure handling).
  persist: 3328,
};

/**
 * CSS budgets in gzip bytes (css-architecture.md §12). Measured 2026-10-17 in the comments:
 * the generated default theme and each component's combined structural and default styles.
 */
export const CSS_BUDGETS = {
  // Measured 2,764 (1,827 before the approved palette, text-style roles, warning ramp, and the
  // complete radius, elevation, motion, stacking, and icon scales; ADRs 0041-0042).
  'tokens:default.css': 3072,
  'components:button': 1280, // measured 1,119 with type.ui and motion tokens (1,100 before)
  'components:card': 768, // measured 678 with type.body and a type.title heading default (571 before)
  'components:input': 896, // measured 743 with type.ui/body/small and motion tokens (647 before)
  'components:side-nav': 1536, // measured 1,234 on 2026-10-18: extracted recipe, structural, and default styles
  'components:shared': 384, // measured 297 on 2026-10-18: host, focus-ring, and visually-hidden primitives
  'components:document': 768, // measured 612 on 2026-10-18: reset.css + base.css + utilities.css
  'components:layout': 512, // measured 411 on 2026-10-18: layout.css page-author classes
  'components:button.css': 1024, // measured 864 on 2026-10-18: button.css, the native <button> styling path
  'ai:styles': 4608, // 4.5 KiB; measured 4,388 on 2026-10-18: every @oddkin/ai element sheet together
};

/** Gzip sizes of the shipped CSS: generated token CSS and component style modules. */
export async function measureCssSizes(root = fileURLToPath(new URL('../../..', import.meta.url))) {
  const sizes = {};
  const gzip = (text) => gzipSync(Buffer.from(text), { level: 9 }).length;
  sizes['tokens:default.css'] = gzip(
    readFileSync(join(root, 'packages/tokens/dist/css/default.css'), 'utf8'),
  );
  for (const name of ['button', 'card', 'input', 'side-nav']) {
    const module = await import(
      pathToFileURL(join(root, `packages/components/dist/${name}/index.js`)).href
    );
    // Each distinct text once: an exported recipe and its extracted styles are the same CSS.
    const text = [
      ...new Set(
        Object.values(module)
          .filter((value) => typeof value?.cssText === 'string')
          .map((value) => value.cssText),
      ),
    ].join('\n');
    sizes[`components:${name}`] = gzip(text);
  }
  const shared = await import(
    pathToFileURL(join(root, 'packages/components/dist/styles/index.js')).href
  );
  sizes['components:shared'] = gzip(
    Object.values(shared)
      .map((value) => value.cssText)
      .join('\n'),
  );
  sizes['components:document'] = gzip(
    ['reset', 'base', 'utilities']
      .map((name) => readFileSync(join(root, `packages/components/dist/css/${name}.css`), 'utf8'))
      .join('\n'),
  );
  sizes['components:layout'] = gzip(
    readFileSync(join(root, 'packages/components/dist/css/layout.css'), 'utf8'),
  );
  sizes['components:button.css'] = gzip(
    readFileSync(join(root, 'packages/components/dist/css/button.css'), 'utf8'),
  );
  // All @oddkin/ai sheets, deduplicated (shared base styles count once).
  const aiDist = join(root, 'packages/ai/dist');
  const sheets = new Set();
  for (const dir of readdirSync(aiDist, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === 'prod') continue;
    for (const file of readdirSync(join(aiDist, dir.name)).filter((f) =>
      f.endsWith('.styles.js'),
    )) {
      const module = await import(pathToFileURL(join(aiDist, dir.name, file)).href);
      for (const value of Object.values(module))
        if (typeof value?.cssText === 'string') sheets.add(value.cssText);
    }
  }
  sizes['ai:styles'] = gzip([...sheets].join('\n'));
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
