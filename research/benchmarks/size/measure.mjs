// Shared bundle-size measurement for the benchmark runner and the size-budget check.
// Production build (default export conditions), esbuild bundle + minify, ESM, es2022.
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const ENTRIES = [
  'counter',
  'component',
  'list',
  'composite',
  'position',
  'typeahead',
  'active-descendant',
  'resize',
  'reactive',
  'ai-headless',
  'ai-response',
  'ai-chat',
  'side-nav',
  'store',
  'context',
  'persist',
  'app',
  'resource',
  'command',
  'router',
  'lifecycle',
  'workbench-panel-component',
  'workbench-panel-foundation',
  'workbench-panel-catalog',
  'workbench-shell',
  'workbench-frame',
];

/** Budgets in gzip bytes (ADR 0019). Measured 2026-10-17 in the comments. */
export const BUDGETS = {
  counter: 9728, // 9.5 KiB; measured 9,280
  component: 11264, // 11 KiB; measured 10,553
  list: 11776, // 11.5 KiB; measured 11,064
  // 12 KiB; measured 11,876 on 2026-10-21 (keyed rows rendering their definition's field and button
  // through @oddkin/core/template/roles, ADR 0043; 370 B more than the same rows with literal tags).
  composite: 12288,
  // 3.75 KiB; measured 3,549 on 2026-10-22 (@oddkin/core/controllers/position with a Scope: the
  // measured-rectangle backend of ADR 0044; Scope with the reactive graph and diagnostics alone
  // is 2,303, so the controller adds about 1.25 KiB).
  position: 3840,
  // 3.25 KiB each; measured 2026-10-22 with a Scope (2,303 alone): typeahead 3,017,
  // active-descendant 3,179, resize 3,164 (@oddkin/core/controllers/*, component-contracts.md §5
  // step 1; each adds 0.7 to 0.9 KiB).
  typeahead: 3328,
  'active-descendant': 3328,
  resize: 3328,
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
  // 5.25 KiB; measured 4,975 on 2026-10-20 (@oddkin/app/app: an application root with a store
  // provided as context, over Scope, the reactive graph, and diagnostics; +208 B since 4,767 on
  // 2026-10-19 for suspend()/resume() of page suspension). Was 5 KiB.
  app: 5376,
  // 3.75 KiB; measured 3,527 on 2026-10-20 (@oddkin/app/resource: a search resource with a
  // timeout, generations, and stale-result guards over Scope, the reactive graph, and diagnostics;
  // +111 B since 3,416 for the restore policy).
  resource: 3840,
  // 4 KiB; measured 3,723 on 2026-10-19 (@oddkin/app/command: a mutation with a retry policy and a
  // timeout, per-attempt scopes, and concurrency handling over Scope, the reactive graph, and
  // diagnostics).
  command: 4096,
  // 7.5 KiB; measured 6,974 on 2026-10-19 (@oddkin/app/router: nested, lazy, and redirecting
  // routes with typed params, History API and link interception, per-level scopes, titles, focus,
  // route announcements through core's LiveAnnouncer (about 0.7 KiB, imported even with
  // `announce: false`), and scroll restoration, over Scope, the reactive graph, and diagnostics).
  // Was 6 KiB (5,461 measured) before focus, announcements, and scroll restoration.
  router: 7680,
  // 5 KiB; measured 4,676 on 2026-10-20 (@oddkin/app/lifecycle with @oddkin/app/app: an
  // application that follows the page lifecycle with one suspendable service, over Scope, the
  // reactive graph, diagnostics, and the context provider the application module imports).
  lifecycle: 5120,
  // Workbench entries, measured 2026-10-22 (Agent 3). Public panels, each registering one element
  // with its renderer and the preview host: component 27,112 (28 KiB), foundation 15,199
  // (16 KiB), catalog 16,654 (17 KiB).
  'workbench-panel-component': 28672,
  'workbench-panel-foundation': 16384,
  'workbench-panel-catalog': 17408,
  // 49 KiB; measured 48,775: the shell with router, search, and every page renderer. This harness
  // does not split, so it includes Theme Studio (about 3.2 KiB), which the shell imports only on
  // its route; with splitting, the initial load is 45,876 and Theme Studio a 4,150 B chunk.
  'workbench-shell': 50176,
  // 7.5 KiB; measured 7,055: the preview frame runtime (protocol, Scope, mount, specimen, theme).
  'workbench-frame': 7680,
};

/**
 * CSS budgets in gzip bytes (css-architecture.md §12). Measured 2026-10-17 in the comments:
 * the generated default theme and each component's combined structural and default styles.
 */
export const CSS_BUDGETS = {
  // Measured 3,059 on 2026-10-22 (2,770 before the info ramp and the tone, selection, and scrim
  // roles; 2,764 at ADRs 0041-0042, 1,827 before the approved palette and foundation scales).
  'tokens:default.css': 3072,
  'components:badge': 384, // measured 375 on 2026-10-22: structural and default styles
  // Display elements, measured on 2026-10-22 (structural and default styles).
  'components:alert': 512, // 458
  'components:avatar': 512, // 430
  'components:chip': 768, // 652
  // Disclosure and navigation elements, measured on 2026-10-22 (structural and default styles).
  'components:disclosure': 768, // 704
  'components:tabs': 768, // 731
  'components:tab-panel': 128, // 96: structural only; odd-tabs draws the panel
  'components:toolbar': 512, // 473
  'components:pagination': 768, // 702
  'components:breadcrumbs': 640, // 561
  'components:empty-state': 512, // 434
  'components:icon': 384, // 305
  'components:progress': 768, // 695
  'components:skeleton': 512, // 413
  'components:spinner': 384, // 319
  'components:button': 1280, // measured 1,028 on 2026-10-22 (spinner moved to the shared module; 1,119 before)
  'components:card': 768, // measured 678 with type.body and a type.title heading default (571 before)
  // 128: measured 55 on 2026-10-22; the field look moved to the shared control module.
  'components:input': 128,
  // 256: measured 244 on 2026-10-23; the box and marks are the shared control-indicator module.
  'components:checkbox': 256,
  // 1,152: measured 1,077 on 2026-10-22 once the entry rows moved to the shared navigation-row
  // module (1,234 before, with them).
  'components:side-nav': 1152,
  // 2,688: measured 2,574 on 2026-10-23 with the control-indicator modules (+346: checkbox box and
  // marks); 2,228 on 2026-10-22 with the navigation-row (+294, moved from odd-side-nav) and
  // option-row (+330) modules; 1,604 before them with the field layout, control look, and select
  // chevron every form control shares (717 before: spinner, tone, glyphs, host, focus ring, visually
  // hidden).
  'components:shared': 2688,
  'components:document': 768, // measured 612 on 2026-10-18: reset.css + base.css + utilities.css
  'components:layout': 512, // measured 411 on 2026-10-18: layout.css page-author classes
  'components:button.css': 1024, // measured 864 on 2026-10-18: button.css, the native <button> styling path
  'components:recipes': 2048, // measured 1,821 on 2026-10-22: the eight CSS recipes together (1,314 before field.css)
  'ai:styles': 4608, // 4.5 KiB; measured 4,388 on 2026-10-18: every @oddkin/ai element sheet together
};

/** Gzip sizes of the shipped CSS: generated token CSS and component style modules. */
export async function measureCssSizes(root = fileURLToPath(new URL('../../..', import.meta.url))) {
  const sizes = {};
  const gzip = (text) => gzipSync(Buffer.from(text), { level: 9 }).length;
  sizes['tokens:default.css'] = gzip(
    readFileSync(join(root, 'packages/tokens/dist/css/default.css'), 'utf8'),
  );
  // Every component with a budget below; its entry module's style exports.
  const components = Object.keys(CSS_BUDGETS)
    .map((key) => /^components:([a-z-]+)$/.exec(key)?.[1])
    .filter((name) => name && existsSync(join(root, `packages/components/dist/${name}/index.js`)));
  for (const name of components) {
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
      .filter((value) => typeof value?.cssText === 'string')
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
  // The opt-in CSS recipes for native markup (component-contracts.md §4), together.
  sizes['components:recipes'] = gzip(
    ['typography', 'link', 'divider', 'kbd', 'list', 'table', 'field', 'avatar-group']
      .map((name) => readFileSync(join(root, `packages/components/dist/css/${name}.css`), 'utf8'))
      .join('\n'),
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
